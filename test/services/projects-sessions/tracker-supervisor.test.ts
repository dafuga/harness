import { DatabaseSync } from 'node:sqlite';
import { once } from 'node:events';
import { test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { measureWorkload } from '../../support/measureWorkload';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSupervisorService } from '../../../src/services/projects-sessions/TrackerSupervisorService';
import { fixturePolicy, primary, secondary } from '../../support/trackerDispatcherFixture';
import { ignoringNode, allIgnored } from '../../support/trackerIgnoreFixture';

const now = () => 1780000000000;
const timestamp = new Date(now()).toISOString();
const statusUnits = [
	'service.projects-sessions-tracker-supervisor',
	'service.projects-sessions-tracker-native-runtime',
	'service.projects-sessions-tracker-persistence',
	'service.projects-sessions-tracker-spoke-loop',
	'service.projects-sessions-tracker-spoke-sync',
	'service.projects-sessions-tracker-dispatch-scheduler',
	'service.agents-providers-tracker-dispatcher'
];

test('reports node status and waits for in-flight work after cancellation', async () => {
	const measureStatus = statusUnits.reduceRight(
		(run, unit) => () => measureWorkload(unit, 'worker-lifecycle', run),
		proveWorkerLifecycle
	);
	await measureStatus();
});

async function proveWorkerLifecycle() {
	const database = new DatabaseSync(':memory:');
	const runtime = configuredSpoke(database);
	const abort = new AbortController();
	const blocked = Promise.withResolvers<void>();
	const entered = Promise.withResolvers<void>();
	const adapter = vi.fn(async () => {
		entered.resolve();
		await blocked.promise;
		runtime.store.maxSeq();
	});
	const notifications = vi.fn(async () => {});
	const service = new TrackerSupervisorService(runtime, {
		ticks: { notifications, adapter },
		intervalMs: 5,
		now
	});
	const running = service.run(abort.signal);
	try {
		await entered.promise;
		await expect(service.run(abort.signal)).rejects.toThrow('already running');
		await expectConnectedFleet(service, runtime);
		await expect.poll(() => notifications.mock.calls.length).toBeGreaterThan(1);
		expect(adapter).toHaveBeenCalledTimes(1);
		abort.abort();
		const settled = vi.fn();
		void running.then(settled);
		await Promise.resolve();
		expect(settled).not.toHaveBeenCalled();
	} finally {
		abort.abort();
		blocked.resolve();
		await running;
		database.close();
	}
	expect(adapter).toHaveBeenCalledTimes(1);
}

test('the hub restores ignored items once their ignore expires, and a spoke leaves them', () =>
	measureWorkload(
		'service.projects-sessions-tracker-supervisor',
		'ignore-expiry',
		proveIgnoreExpiry
	));

async function proveIgnoreExpiry() {
	// A date expires at 00:00 Lisbon, which is 23:00 UTC the day before in summer.
	let at = Date.parse('2026-07-01T10:00:00Z');
	const clock = () => at;
	const hub = await ignoringNode('hub', clock);
	const spoke = await ignoringNode('spoke', clock);
	const abort = new AbortController();
	const sweeps = vi.fn(async () => {});
	const running = [hub, spoke].map(({ runtime }) =>
		new TrackerSupervisorService(runtime, {
			ticks: { adapter: sweeps },
			intervalMs: 5,
			now: clock
		}).run(abort.signal)
	);
	const settle = async () => {
		const target = sweeps.mock.calls.length + 6;
		await expect.poll(() => sweeps.mock.calls.length).toBeGreaterThan(target);
	};
	try {
		at = Date.parse('2026-07-01T22:59:59Z');
		await settle();
		expect(hub.statuses()).toEqual(allIgnored);
		at = Date.parse('2026-07-01T23:00:00Z');
		await expect.poll(hub.statuses).toEqual({ ...allIgnored, dated: 'in_progress' });
		at = Date.parse('2026-07-02T09:30:00Z');
		await expect.poll(hub.statuses).toEqual({ ...allIgnored, dated: 'in_progress', timed: 'open' });
		const settled = hub.runtime.store.maxSeq();
		await settle();
		expect(hub.runtime.store.maxSeq()).toBe(settled);
		expect(spoke.statuses()).toEqual(allIgnored);
		expect(hub.row('dated')).toMatchObject({ ignored_until: null, needs_daniel: 1 });
		expect(hub.lastNote('dated')).toBe('ignore expired; back to in_progress');
		expect(hub.lastNote('timed')).toBe('ignore expired; back to open');
	} finally {
		abort.abort();
		await Promise.all(running);
		hub.database.close();
		spoke.database.close();
	}
}

function expectConnectedFleet(
	service: TrackerSupervisorService,
	runtime: TrackerNativeRuntimeService
) {
	return expect
		.poll(() => service.status())
		.toMatchObject({
			role: 'spoke',
			node: primary,
			db_id: runtime.store.dbId,
			sync: {
				hub: 'fixture-hub',
				connected: true,
				lastPullOk: timestamp,
				lastPushOk: timestamp,
				lastError: null,
				pending_push: 0
			},
			autolaunch: {
				computers: [
					{ computer: primary, state: 'polling', active_runs: 0 },
					{ computer: secondary, state: 'polling', last_tick_at: timestamp, active_runs: 2 },
					{ computer: 'grok-box', state: 'offline', active_runs: null }
				]
			}
		});
}

function configuredSpoke(database: DatabaseSync) {
	let pulled = false;
	const runtime = new TrackerNativeRuntimeService(database, {
		node: primary,
		now,
		role: 'spoke',
		dispatch: {
			policy: fixturePolicy(now),
			runner: { start: async () => undefined, observe: async () => undefined },
			telemetry: { sample: () => ({ at: timestamp }) }
		},
		links: [
			{
				secret: 'synthetic-supervisor-status-fixture',
				async transport(request, signal) {
					if (request.pathAndQuery === '/sync/machine')
						return {
							ok: true,
							machines: [
								{
									node: secondary,
									at: timestamp,
									runner: {
										enabled: true,
										last_tick_at: timestamp,
										active: 2
									}
								}
							]
						};
					if (request.method === 'POST') return { ok: true, db_id: 'fixture-db' };
					if (!pulled) {
						pulled = true;
						return { hub: 'fixture-hub', db_id: 'fixture-db', ops: [], max: 0, last: 0 };
					}
					await once(signal, 'abort');
					throw signal.reason;
				}
			}
		]
	});
	runtime.store.appendLocal({ itemId: 'status-fixture', fields: { title: 'Status fixture' } });
	return runtime;
}
