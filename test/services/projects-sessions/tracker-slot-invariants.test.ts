import { afterEach, expect, test, vi } from 'vitest';
import { sendWatchdogAlerts } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostCos';
import { trackerWatchdogPort } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerWatchdogPort';
import { withTempDir } from '../../support/temporary';
import { measureWorkload } from '../../support/measureWorkload';
import { composer, protectedPanes, trackerSlotFixture } from '../../support/trackerSlotFixture';
import { slotProviders as providers } from '../../support/trackerSlotProviders';
import type {
	TrackerSlotFixture,
	TrackerSlotProvider
} from '../../support/trackerSlotFixture.types';

const noon = Date.parse('2026-11-25T12:00:00Z');
const minute = 60_000;
// Each tick runs the scripted tmux and host driver as real processes.
vi.setConfig({ testTimeout: 180_000 });
afterEach(() => vi.useRealTimers());

const item = 'leak000001';
const pane = 'auto-leak00-r1';
const statuses = ['open', 'in_progress', 'blocked', 'done', 'ignored'];

const outcomes: Record<
	string,
	(hub: TrackerSlotFixture, provider: TrackerSlotProvider) => Promise<void>
> = {
	async done(hub) {
		await hub.request(`/items/${item}/done`);
		await hub.advance(5_000);
	},
	async blocked(hub) {
		await hub.request(`/items/${item}/block`, { reason: 'Choose the synthetic region' });
		await hub.advance(5_000);
	},
	async abandoned(hub, { idle }) {
		await hub.request(`/items/${item}/note`, { text: 'stopped: context limit; resume here' });
		hub.screen(pane, idle);
		await hub.advance(16 * minute);
		await hub.advance(5_000);
	},
	async failed(hub) {
		await hub.request(`/items/${item}/block`, { reason: 'Synthetic wait', needs_daniel: false });
		await hub.request(`/items/${item}/unblock`);
		hub.change(pane, { exit: 3 });
		await hub.advance(5_000);
	},
	async timed_out(hub) {
		await hub.advance(481 * minute);
		expect(hub.runs(item)).toEqual([{ state: 'running', outcome: null }]);
		// Upgraded journals can still contain a legacy timeout while its pane is alive.
		hub.database
			.prepare(
				"UPDATE runs SET state = 'finished', outcome = 'timed_out', ended_at = ? WHERE item_id = ?"
			)
			.run(hub.now(), item);
	}
};

const slotCase = (name: string, prove: (fixture: TrackerSlotFixture) => Promise<void>) =>
	measureWorkload('service.projects-sessions-tracker-native-runtime', name, () =>
		withTempDir('hnt-invariant-', async (root) => {
			const fixture = trackerSlotFixture(root, noon);
			try {
				await prove(fixture);
				expect(fixture.allPanes()).toEqual(expect.arrayContaining(protectedPanes));
				const flagged = fixture.runtime.watchdog!.alerts().map(({ session }) => session);
				expect(flagged.filter((session) => protectedPanes.includes(session!))).toEqual([]);
			} finally {
				fixture.database.close();
			}
		})
	);

const slotAlerts = (hub: TrackerSlotFixture, session = pane) =>
	hub.runtime
		.watchdog!.alerts()
		.filter((alert) => alert.session === session)
		.filter(({ kind }) => ['finished', 'finished-run-pane', 'idle-run'].includes(kind));

async function start(hub: TrackerSlotFixture, { model }: TrackerSlotProvider) {
	hub.queue(item, model);
	await hub.advance(0);
	await hub.request(`/items/${item}/start`);
	await hub.advance(5_000);
}

async function dryRun(hub: TrackerSlotFixture) {
	const result = await hub.runtime.watchdog!.inspect(null, new AbortController().signal);
	return result.slots!;
}

for (const provider of providers) {
	for (const [outcome, finish] of Object.entries(outcomes)) {
		test(`${provider.cli}: a ${outcome} run's live pane is flagged after 5 min for every item status`, () =>
			slotCase(`leaked-${outcome}-pane-${provider.cli}`, async (hub) => {
				await start(hub, provider);
				hub.change(pane, { unkillable: true });
				await finish(hub, provider);
				expect(hub.runs(item)[0]).toEqual({ state: 'finished', outcome });
				// Inside the grace nothing is wrong yet, even for a done item.
				await hub.advance(2 * minute);
				expect(slotAlerts(hub)).toEqual([]);
				await hub.advance(4 * minute);
				const [first] = slotAlerts(hub);
				expect(first).toMatchObject({ kind: 'finished-run-pane', item_id: item });
				expect(first.reason).toContain(`after run #1 finished (${outcome}).`);
				for (const status of statuses) {
					hub.runtime.store.appendLocal({ itemId: item, fields: { status } });
					await hub.advance(2 * minute);
					const alerts = slotAlerts(hub);
					// One alert per leak: a status change neither repeats nor hides it.
					expect(alerts.map(({ id }) => id)).toEqual([first.id]);
					expect(alerts[0].slots).toContain('launcher slots held');
					expect(alerts[0].slots).toContain(`${pane} still live`);
					expect(alerts[0].slots).toContain(`item ${status}`);
				}
				hub.change(pane, { unkillable: false });
				hub.screen(pane, provider.idle);
				hub.runtime.store.appendLocal({ itemId: item, fields: { status: 'done' } });
				await hub.advance(2 * minute);
				await hub.advance(2 * minute);
				expect(hub.panes()).not.toContain(pane);
				expect(slotAlerts(hub)).toEqual([]);
			}));
	}

	test(`${provider.cli}: keep-alive exceptions hold the finished-run alert back`, () =>
		slotCase(`kept-finished-panes-${provider.cli}`, async (hub) => {
			await start(hub, provider);
			await hub.request(`/items/${item}/block`, { reason: 'Upload waits', needs_daniel: false });
			hub.screen(pane, provider.background);
			for (let poll = 0; poll < 5; poll++) await hub.advance(3 * minute);
			expect(hub.panes()).toContain(pane);
			expect(slotAlerts(hub)).toEqual([]);
			expect((await dryRun(hub)).leftover).toMatchObject([
				{ session: pane, why: 'kept: live background work for an open item; item blocked' }
			]);
			hub.change(pane, { attached: true, screen: provider.idle });
			await hub.advance(2 * minute);
			expect(slotAlerts(hub)).toEqual([]);
			expect((await dryRun(hub)).leftover[0].why).toBe('kept: someone is attached; item blocked');
			// A closed item no longer protects its background work.
			hub.change(pane, { attached: false, screen: provider.background, unkillable: true });
			await hub.request(`/items/${item}/done`);
			await hub.advance(2 * minute);
			expect(slotAlerts(hub).map(({ kind }) => kind)).toEqual(['finished-run-pane']);
		}));

	test(`${provider.cli}: a running run idle at its composer is flagged after 15 min`, () =>
		slotCase(`idle-running-run-${provider.cli}`, async (hub) => {
			await start(hub, provider);
			hub.screen(pane, provider.idle);
			await hub.advance(14 * minute);
			expect(slotAlerts(hub)).toEqual([]);
			await hub.advance(2 * minute);
			expect(hub.runs(item)).toEqual([{ state: 'running', outcome: null }]);
			const [first] = slotAlerts(hub);
			expect(first).toMatchObject({ kind: 'idle-run', item_id: item });
			expect(first.slots).toMatch(/^1\/1 launcher slots held: #1 leak00 idle at the composer 16m/);
			for (const status of ['open', 'ignored', 'in_progress']) {
				hub.runtime.store.appendLocal({ itemId: item, fields: { status } });
				await hub.advance(2 * minute);
				expect(slotAlerts(hub).map(({ id }) => id)).toEqual([first.id]);
			}
			const report = await dryRun(hub);
			expect(report).toMatchObject({ computer: 'daniel-primary-mbp', cap: 1 });
			expect(report.held).toMatchObject([{ run: 1, item, state: 'running', session: pane }]);
			expect(report.violations.map(({ kind }) => kind)).toEqual(['idle-run']);
			// Attached, working and background sessions are not idle leaks.
			for (const fields of [
				{ attached: true },
				{ attached: false, screen: provider.background },
				{ screen: 'Working (esc to interrupt)' }
			]) {
				hub.change(pane, fields);
				await hub.advance(2 * minute);
				expect(slotAlerts(hub)).toEqual([]);
			}
		}));
}

test('a run the launcher finishes in the same poll is never reported as idle', () =>
	slotCase('settled-run-not-flagged', async (hub) => {
		await start(hub, providers[0]);
		await hub.request(`/items/${item}/note`, { text: 'stopped: waiting; resume from notes' });
		hub.screen(pane, composer());
		await hub.advance(16 * minute);
		expect(hub.runs(item)).toEqual([{ state: 'finished', outcome: 'abandoned' }]);
		expect(slotAlerts(hub)).toEqual([]);
	}));

test('the Chief of Staff message lists the held slots for each computer', () =>
	slotCase('slot-summary-message', async (hub) => {
		await start(hub, providers[0]);
		hub.screen(pane, composer());
		await hub.advance(16 * minute);
		const local = slotAlerts(hub);
		const peer = { ...local[0], id: 'peer-alert', host: 'harbor-mbp-2', slots: '0/8 held' };
		vi.useFakeTimers({ toFake: ['Date'], now: noon });
		const port = trackerWatchdogPort({ tmux: hub.tmux, chiefOfStaff: true }, 'daniel-primary-mbp');
		await sendWatchdogAlerts(
			hub.runtime.store,
			port,
			[...local, peer],
			new AbortController().signal
		);
		expect(hub.tmuxInput()).toContain('Slots by computer: daniel-primary-mbp: 1/1 launcher slots');
		expect(hub.tmuxInput()).toContain('harbor-mbp-2: 0/8 held');
		expect(hub.tmuxInput()).toMatch(/Watchdog receipts: [\da-f]{24},[\da-f]{24}/);
	}));
