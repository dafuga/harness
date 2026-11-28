import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, test, vi } from 'vitest';
import { nativeTrackerArgs } from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';
import { TrackerSyncAuthService } from '../../../src/services/networking-security/TrackerSyncAuthService';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { trackerHandoffHold } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHandoffHold';
import { trackerClaudePreferredUntil } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerProviderPreference';
import { quotaHost } from '../../support/trackerQuotaPauseFixture';
import { fixtureSecret, wire } from '../../support/trackerDispatchQueueFixture';
import { withTempDir } from '../../support/temporary';

// After the old 27 November window, so the default table is the Codex one.
const start = Date.parse('2026-11-28T12:00:00Z');
const until = '2026-11-28T13:00:00.000Z';
const prefer = { provider: 'claude', until };
const title = { title: 'Add the synthetic export view' };
const sol = { id: 'sol', cli: 'codex', model: 'gpt-6.2-sol', effort: 'medium' } as const;

function picks(database: DatabaseSync) {
	return database
		.prepare('SELECT item_id, cli, model, effort, reason FROM runs ORDER BY queued_at, id')
		.all();
}

test('a launch picks Claude while the preference is on and Codex after it expires', () =>
	withTempDir('hnt-prefer-', async (root) => {
		const host = quotaHost(root);
		host.clock.now = start;
		try {
			expect((await host.api('POST', '/autolaunch/prefer', prefer)).status).toBe(200);
			expect((await host.api('GET', '/autolaunch')).body.provider_preference).toMatchObject(prefer);
			expect((await host.api('GET', '/autolaunch/preference')).body).toMatchObject({
				provider_preference: prefer
			});
			host.queue('first00001', title);
			host.queue('pinned0002', { ...title, model: 'gpt-6.2-sol:medium' });
			await host.tick();
			await host.tick();
			expect(picks(host.database)).toEqual([
				expect.objectContaining({ cli: 'claude', model: 'claude-sonnet-5-5', effort: 'medium' }),
				expect.objectContaining({ cli: 'claude', reason: expect.stringContaining('switched to') })
			]);
			host.clock.now = Date.parse(until);
			expect((await host.api('GET', '/autolaunch')).body.provider_preference).toBeNull();
			host.queue('after00003', title);
			await host.tick();
			expect(picks(host.database).at(-1)).toMatchObject({ cli: 'codex', model: 'gpt-6.2-sol' });
		} finally {
			host.database.close();
		}
	}));

test('a watchdog handoff of a Codex session relaunches on Claude', () =>
	withTempDir('hnt-prefer-handoff-', async (root) => {
		const host = quotaHost(root);
		host.clock.now = start;
		try {
			await host.api('POST', '/autolaunch/prefer', prefer);
			host.queue('handoff001', title);
			host.runtime.store.appendLocal({
				itemId: 'handoff001',
				fields: { status: 'in_progress', auto: null }
			});
			await host.runtime.dispatch!.request('handoff001', {
				source: 'recovery',
				token: 'handoff-token',
				expectedAuto: null,
				rung: { ...sol, pinned: true }
			});
			expect(picks(host.database)).toEqual([
				expect.objectContaining({
					cli: 'claude',
					reason: expect.stringContaining('gpt-6.2-sol replaced')
				})
			]);
		} finally {
			host.database.close();
		}
	}));

test('an attempt queued on Codex before the switch starts on Claude', () =>
	withTempDir('hnt-prefer-queued-', async (root) => {
		const host = quotaHost(root);
		host.clock.now = start;
		try {
			host.queue('queued0001', title);
			host.runtime.store.appendLocal({
				itemId: 'queued0001',
				fields: { status: 'in_progress', auto: null }
			});
			await host.runtime.dispatch!.request('queued0001', {
				source: 'recovery',
				token: 'queued-token',
				expectedAuto: null,
				rung: { ...sol, pinned: true }
			});
			expect(picks(host.database)).toEqual([expect.objectContaining({ cli: 'codex' })]);
			await host.api('POST', '/autolaunch/prefer', prefer);
			await host.tick();
			expect(host.database.prepare('SELECT cli, model, state FROM runs').all()).toEqual([
				{ cli: 'claude', model: 'claude-sonnet-5-5', state: 'running' }
			]);
		} finally {
			host.database.close();
		}
	}));

test('a Codex quota hold does not delay a handoff that will start on Claude', () =>
	withTempDir('hnt-prefer-hold-', async (root) => {
		const host = quotaHost(root);
		host.clock.now = start;
		const store = host.runtime.store;
		const input = { item: title, run: sol, now: start };
		try {
			store.writeMeta({ autolaunch_quota_codex: until });
			expect(trackerHandoffHold(store, input)).toContain('codex quota exhausted');
			await host.api('POST', '/autolaunch/prefer', prefer);
			expect(trackerHandoffHold(store, input)).toBeNull();
		} finally {
			host.database.close();
		}
	}));

test('the preference rejects a past or missing end and can be cleared', () =>
	withTempDir('hnt-prefer-input-', async (root) => {
		const host = quotaHost(root);
		host.clock.now = start;
		try {
			for (const body of [
				{ provider: 'claude' },
				{ provider: 'claude', until: '2026-11-28T11:00:00Z' },
				{ provider: 'codex', until }
			])
				expect((await host.api('POST', '/autolaunch/prefer', body)).status).toBe(400);
			await host.api('POST', '/autolaunch/prefer', prefer);
			expect((await host.api('POST', '/autolaunch/prefer', { provider: null })).body).toMatchObject(
				{ provider_preference: null }
			);
		} finally {
			host.database.close();
		}
	}));

test('prefer and the Codex pause are native commands', () => {
	const request = (...args: string[]) => nativeTrackerArgs(['autolaunch', ...args]).request;
	const on = { method: 'POST', path: '/autolaunch/prefer', body: prefer };
	const off = { method: 'POST', path: '/autolaunch/prefer', body: { provider: null } };
	expect(request('prefer', 'claude', '--until', until)).toEqual(on);
	expect(request('pause', 'codex', '--until', until)).toEqual(on);
	expect(request('prefer', 'default')).toEqual(off);
	expect(request('resume', 'codex')).toEqual(off);
	expect(() => request('prefer', 'claude')).toThrow('usage');
	expect(() => request('pause', 'codex')).toThrow('usage');
	expect(() => request('prefer', 'codex', '--until', until)).toThrow('usage');
});

test('a preference set and cleared on the hub reaches a spoke over its hub link', async () => {
	let clock = start;
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
		for (const request of [prefer, { provider: null }]) {
			clock += 1000;
			const expected = hub.admin.prefer(request).provider_preference?.until;
			await vi.waitFor(
				() => expect(trackerClaudePreferredUntil(spoke.store, clock)).toBe(expected),
				{ timeout: 4000, interval: 20 }
			);
		}
	} finally {
		lifetime.abort();
		await links;
		for (const database of databases) database.close();
	}
});
