import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { readClaudeCosReceipts } from '../../../src/adapters/projects-sessions/tracker-tmux-adapter/readClaudeCosReceipt';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRunReadRepository } from '../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { recordWatchdogAlert } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostWatchdogAlerts';
import { readWatchdogAlerts } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostWatchdogState';
import {
	cosReceiptReference,
	sendWatchdogAlerts
} from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostCos';
import { trackerCosRound } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerCosRound';
import { trackerWatchdogPort } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerWatchdogPort';
import { claudePaneFixture } from '../../support/claudePaneFixture';
import {
	alarmAsks,
	alert,
	cosDeliveryFixture,
	minute,
	noon,
	readCosPrompts,
	recordedDependencyQueue,
	writeAcceptedPrompts
} from '../../support/trackerCosDeliveryFixture';
import { withTempDir } from '../../support/temporary';

const now = Date.UTC(2026, 10, 25, 23);

test(
	'oversized CoS alerts fit the 80x24 composer and leave room for the next alert',
	() =>
		cosDeliveryFixture(({ store }) =>
			withTempDir('hnt-cos-window-', async (root) => {
				const executable = join(root, 'tmux-fixture');
				writeFileSync(executable, `#!${process.execPath}\n${claudePaneFixture}`, { mode: 0o700 });
				writeFileSync(join(root, 'mode'), 'window-80x24');
				const queue = recordedDependencyQueue().map((alert, index) => ({
					...alert,
					item_id: `alert${index}0000`,
					reason: index === 7 ? 'Urgent access dependency '.repeat(16) : alert.reason,
					slots: 'Busy slots. '.repeat(140)
				}));
				queue.push({
					...queue[7],
					id: 'next-alert',
					item_id: 'next010000',
					reason: 'Another item needs review.',
					at: queue[7].at + 1
				});
				const started = performance.now();
				let clock = Date.UTC(2026, 10, 27, 15);
				const date = vi
					.spyOn(Date, 'now')
					.mockImplementation(() => clock + performance.now() - started);
				try {
					const driver = trackerWatchdogPort(
						{ tmux: executable, chiefOfStaff: true },
						'daniel-primary-mbp'
					);
					const signal = AbortSignal.timeout(22_000);
					await sendWatchdogAlerts(store, driver, queue, signal);
					const pane = JSON.parse(readFileSync(join(root, 'state'), 'utf8'));
					expect(pane.enters, 'the first batch must submit in the 80x24 pane').toBe(1);
					for (let round = 0; round < 2; round++) {
						clock += 6 * minute;
						await sendWatchdogAlerts(store, driver, queue, signal);
					}
					const prompts = readCosPrompts(root);
					expect(prompts).toHaveLength(3);
					expect(
						Math.max(...prompts.map((prompt) => Buffer.byteLength(prompt)))
					).toBeLessThanOrEqual(450);
					for (const alert of queue.slice(0, 7))
						expect(prompts.join(' | ')).toContain(
							`[${alert.item_id.slice(0, 6)}] CoS: credential/access dependency.`
						);
					expect(prompts[1]).toContain('[alert7] See the full alert in Tracker.');
					expect(JSON.parse(store.getMeta('watchdog_cos_sent') ?? '[]')).toContain('next-alert');
				} finally {
					date.mockRestore();
				}
			})
		).then(proveLiveTurnDelivery),
	25_000
);

test('Claude transcript receipts prevent another send when tmux misses acceptance', () =>
	cosDeliveryFixture(async ({ store, items }) => {
		const queue = recordedDependencyQueue();
		const rows = queue.map((alert) => ({
			id: alert.id,
			line: `[${alert.item_id.slice(0, 6)}] ${alert.host}: ${alert.reason.slice(0, 500)}`,
			reference: cosReceiptReference(alert),
			since: alert.at
		}));
		let clock = Math.max(...queue.map(({ at }) => at)) + 20 * minute;
		await withTempDir('hnt-cos-transcript-', async (root) => {
			writeAcceptedPrompts(root, rows, new Date(clock).toISOString());
			const sent: string[][] = [];
			const driver = {
				scan: async () => null,
				nudge: async () => false,
				receipts: () => readClaudeCosReceipts('/fixture/cos', rows, root),
				send: async (batch: Readonly<typeof queue>) => {
					sent.push(batch.map(({ id }) => id));
					return false;
				}
			};
			const watchdog = trackerCosRound(store, driver, { now: () => clock, local: () => queue });
			const signal = new AbortController().signal;
			await watchdog.run(signal, false);
			clock += 5 * minute;
			await watchdog.run(signal, false);
			expect(sent).toEqual([]);
			expect(alarmAsks(items, clock)).toEqual([]);
		});
	}));

function proveLiveTurnDelivery() {
	return cosDeliveryFixture(({ store, items }) =>
		withTempDir('hnt-cos-live-turn-', async (root) => {
			const executable = join(root, 'tmux-fixture');
			writeFileSync(executable, `#!${process.execPath}\n${claudePaneFixture}`, { mode: 0o700 });
			const mode = (value: string) => writeFileSync(join(root, 'mode'), value);
			const started = performance.now();
			let clock = noon;
			const date = vi
				.spyOn(Date, 'now')
				.mockImplementation(() => clock + performance.now() - started);
			const driver = trackerWatchdogPort(
				{ tmux: executable, chiefOfStaff: true },
				'daniel-primary-mbp'
			);
			let queue = [alert('alert', clock - 16 * minute)];
			const watchdog = trackerCosRound(
				store,
				{ ...driver, peers: undefined },
				{ now: () => clock, local: () => queue }
			);
			const tick = () => watchdog.run(AbortSignal.timeout(18_000), false);
			try {
				mode('busy');
				await tick();
				expect(alarmAsks(items, clock), 'a live mid-turn CoS is not a delivery outage').toEqual([]);
				await idleTick();
				expect(readCosPrompts(root)).toHaveLength(1);

				await busyTick('alert');
				await idleTick();
				expect(readCosPrompts(root), 'idle retry bypasses the routine cadence').toHaveLength(2);

				await busyTick('idle');
				clock += 29 * minute;
				await tick();
				expect(alarmAsks(items, clock)).toEqual([]);
				clock += minute;
				await tick();
				const [alarm] = alarmAsks(items, clock);
				expect(alarm).toBeDefined();
				await idleTick();
				expect(readCosPrompts(root)).toHaveLength(3);
				expect(alarmAsks(items, clock)).toEqual([]);
				expect(items.getStored(alarm.id)).toMatchObject({ status: 'done', needs_daniel: false });
			} finally {
				date.mockRestore();
			}

			async function busyTick(kind: string) {
				clock += minute;
				queue = [alert(kind, clock)];
				mode('busy');
				await tick();
			}

			async function idleTick() {
				clock += minute;
				mode('idle');
				await tick();
			}
		})
	);
}

const options = [
	{ label: 'Approve', effect: '', recommended: true },
	{ label: 'Hold', effect: '' }
];

/** One real Daniel decision is open, beside a working item a session may ping about. */
function tracker() {
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, 'fixture-hub', { now: () => now });
	const items = new TrackerItemReadRepository(database);
	const api = new TrackerLocalApiService(store, items, {
		now: () => now,
		runs: new TrackerRunReadRepository(database, store.node)
	});
	for (const [itemId, title] of [
		['decision1', 'Synthetic decision'],
		['worker001', 'Synthetic worker']
	])
		store.appendLocal({ itemId, fields: { title, status: 'in_progress', kind: 'task' } });
	store.appendLocal({
		itemId: 'decision1',
		fields: {
			needs_daniel: 1,
			resolved: 0,
			question: 'Approve the synthetic spec?',
			options: JSON.stringify(options)
		}
	});
	const needsYou = () => items.digest(now).daniel_decisions.map(({ id }) => id);
	const post = (path: string, body: object) =>
		api.handle(
			new Request(`http://127.0.0.1${path}`, { method: 'POST', body: JSON.stringify(body) })
		);
	return { database, store, items, needsYou, post };
}

test('a watchdog idle ping goes to the Chief of Staff channel only', () => {
	const { database, store, items, needsYou } = tracker();
	try {
		const before = needsYou();
		recordWatchdogAlert(
			store,
			{
				itemId: 'worker001',
				kind: 'idle',
				reason: 'Session auto-worker-r1 is idle again after a watchdog check-in.',
				identity: 'pane:1'
			},
			now
		);
		expect(needsYou()).toEqual(before);
		const item = items.getStored('worker001');
		expect(item).toMatchObject({ needs_daniel: false, question: null, status: 'in_progress' });
		expect(item.notes_log.at(-1)?.text).toMatch(/^watchdog idle:/);
		// The CoS channel: what `tracker needs-attention` serves and the CoS tick delivers.
		expect(readWatchdogAlerts(store)['worker001:idle']).toMatchObject({ item_id: 'worker001' });
	} finally {
		database.close();
	}
});

test('a watchdog alert never replaces an open Daniel decision', () => {
	const { database, store, items, needsYou } = tracker();
	try {
		recordWatchdogAlert(
			store,
			{ itemId: 'decision1', kind: 'idle', reason: 'Idle again.', identity: 'pane:2' },
			now
		);
		expect(needsYou()).toEqual(['decision1']);
		expect(items.getStored('decision1').question).toBe('Approve the synthetic spec?');
	} finally {
		database.close();
	}
});

for (const question of [
	'daniel-primary-mbp: Session auto-x-r1 is idle again after a watchdog check-in. Chief of Staff, please inspect the session.',
	'CoS: please publish the canvas from your session.',
	'Chief of Staff: which computer should run this?'
])
	test(`a flag addressed to Chief of Staff never asks Daniel: ${question.slice(0, 24)}`, async () => {
		const { database, store, items, needsYou, post } = tracker();
		try {
			const response = await post('/items/worker001/flag', { question, options });
			expect(response.status).toBe(200);
			expect(needsYou()).toEqual(['decision1']);
			const item = items.getStored('worker001');
			expect(item.needs_daniel).toBe(false);
			expect(item.notes_log.at(-1)?.text).toContain('Chief of Staff');
			expect(Object.values(readWatchdogAlerts(store))).toMatchObject([
				{ item_id: 'worker001', kind: 'cos-message', reason: question }
			]);
		} finally {
			database.close();
		}
	});
