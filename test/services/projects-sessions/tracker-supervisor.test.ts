import { DatabaseSync } from 'node:sqlite';
import { once } from 'node:events';
import { test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { measureWorkload } from '../../support/measureWorkload';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSupervisorService } from '../../../src/services/projects-sessions/TrackerSupervisorService';
import { fixturePolicy, primary, secondary } from '../../support/trackerDispatcherFixture';

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
