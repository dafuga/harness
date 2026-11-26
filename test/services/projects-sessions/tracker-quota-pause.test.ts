import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, test, vi } from 'vitest';
import { TrackerSyncAuthService } from '../../../src/services/networking-security/TrackerSyncAuthService';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { quotaHost, quotaNode } from '../../support/trackerQuotaPauseFixture';
import { fixtureSecret, wire } from '../../support/trackerDispatchQueueFixture';
import { withTempDir } from '../../support/temporary';

const exhausted =
	"\u001b[38;5;246m  ⎿  \u001b[38;5;211mYou've hit your session limit · resets 3pm (Europe/Lisbon)\n";

test('an exhausted provider holds new starts until clear-quota', () =>
	withTempDir('hnt-quota-', async (root) => {
		const host = quotaHost(root);
		try {
			host.queue('first00001');
			await host.tick();
			host.screen(
				'  ⎿  Warning: you have hit your usage limit. Continuing with credits automatically\n'
			);
			await host.tick();
			host.screen('⏺ The test prints "You\'ve hit your usage limit" when it fails.\n');
			await host.tick();
			expect((await host.api('GET', '/autolaunch')).body.quota_holds.claude).toBeNull();

			host.screen(exhausted);
			host.queue('second0002');
			await host.tick();
			expect(host.runs()).toHaveLength(1);
			expect(host.runtime.scheduler!.runnerStatus().waiting_on).toBe(
				`claude quota exhausted on ${quotaNode}`
			);
			expect((await host.api('GET', '/autolaunch')).body.quota_holds.claude).toEqual(
				expect.any(String)
			);
			expect(
				host.database.prepare("SELECT text FROM item_notes WHERE item_id = 'first00001'").all()
			).toContainEqual({ text: expect.stringContaining('tracker autolaunch clear-quota claude') });
			expect(host.runtime.watchdog!.alerts()).toContainEqual(
				expect.objectContaining({ item_id: 'first00001', kind: 'quota-hold' })
			);

			expect((await host.api('POST', '/autolaunch/clear-quota', { provider: 'x' })).status).toBe(
				400
			);
			const cleared = await host.api('POST', '/autolaunch/clear-quota', { provider: 'claude' });
			expect(cleared.body).toEqual({ provider: 'claude', cleared: true, waiting_on: null });
			// The first run still shows the same notice; it must not restore the cleared hold.
			await host.tick();
			expect(host.runs()).toHaveLength(2);
			expect((await host.api('GET', '/autolaunch')).body.quota_holds.claude).toBeNull();
			// A different run showing the notice is new evidence.
			await host.tick();
			expect((await host.api('GET', '/autolaunch')).body.quota_holds.claude).toEqual(
				expect.any(String)
			);
		} finally {
			host.database.close();
		}
	}));

test('a configured Codex pause holds Codex starts and leaves Claude running', () =>
	withTempDir('hnt-codex-pause-', async (root) => {
		const host = quotaHost(root, { codexPausedUntil: '2026-11-25T13:00:00Z' });
		try {
			host.queue('codex00001', { model: 'gpt-6.2-sol' });
			host.queue('claude0002', { model: 'sonnet' });
			await host.tick();
			await host.tick();
			expect(host.runs()).toEqual([{ item_id: 'claude0002', cli: 'claude', state: 'running' }]);
			expect((await host.api('GET', '/autolaunch')).body).toMatchObject({
				codex_paused: true,
				codex_paused_until: '2026-11-25T13:00:00Z'
			});
			host.clock.now = Date.parse('2026-11-25T13:00:00Z');
			await host.tick();
			expect(host.runs()).toHaveLength(2);
		} finally {
			host.database.close();
		}
	}));

test('due pause stops due starts and the due preview until resume', () =>
	withTempDir('hnt-due-pause-', async (root) => {
		const host = quotaHost(root);
		try {
			expect((await host.api('POST', '/autolaunch/pause')).body).toMatchObject({ paused: true });
			host.runtime.store.appendLocal({
				itemId: 'dueitem001',
				fields: {
					title: 'Update the README wording',
					kind: 'task',
					status: 'open',
					project: 'Harness',
					computer: quotaNode,
					due: '2026-11-25T11:00:00Z'
				}
			});
			await host.tick();
			expect(host.runs()).toEqual([]);
			expect((await host.api('GET', '/autolaunch/dry-run')).body.paused).toBe(true);
			expect((await host.api('POST', '/autolaunch/resume')).body).toMatchObject({ paused: false });
			await host.tick();
			expect(host.runs()).toHaveLength(1);
		} finally {
			host.database.close();
		}
	}));

test('a hub due pause and resume reach a spoke over its hub link', async () => {
	let clock = 5000;
	const databases = [new DatabaseSync(':memory:'), new DatabaseSync(':memory:')];
	const hub = new TrackerNativeRuntimeService(databases[0], {
		node: 'hub',
		role: 'hub',
		now: () => clock,
		storage: { databaseId: () => 'fixture-hub' },
		syncResponder: { auth: new TrackerSyncAuthService(fixtureSecret) }
	});
	const direct = wire(hub.sync!);
	const spoke = new TrackerNativeRuntimeService(databases[1], {
		node: 'alpha',
		role: 'spoke',
		now: () => clock,
		storage: { databaseId: () => 'fixture-alpha' },
		links: [
			{
				secret: fixtureSecret,
				pullWaitSeconds: 0,
				// A real hub long-polls; without a timer tick this in-process loop starves the test.
				transport: async (request) => {
					await delay(5);
					return direct(request);
				}
			}
		]
	});
	const lifetime = new AbortController();
	const links = spoke.runLinks(lifetime.signal);
	try {
		for (const paused of [true, false]) {
			clock += 1000;
			hub.store.writeMeta({ due_scheduler_paused: paused ? '1' : '0' });
			await vi.waitFor(() => expect(spoke.duePreview.due().paused).toBe(paused), {
				timeout: 4000,
				interval: 20
			});
			clock += 1000;
		}
	} finally {
		lifetime.abort();
		await links;
		for (const database of databases) database.close();
	}
});

test('autolaunch pause and resume belong to the hub', () => {
	const database = new DatabaseSync(':memory:');
	const spoke = new TrackerNativeRuntimeService(database, {
		node: 'alpha',
		role: 'spoke',
		storage: { databaseId: () => 'fixture-alpha' }
	});
	try {
		expect(() => spoke.admin.pauseDue(true)).toThrow(
			'run tracker autolaunch pause or resume on the hub'
		);
	} finally {
		database.close();
	}
});
