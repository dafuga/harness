import { DatabaseSync } from 'node:sqlite';
import { test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import type { TrackerDispatchRunner } from '../../../src/services/projects-sessions/TrackerDispatchSchedulerService.types';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSyncAuthService } from '../../../src/services/networking-security/TrackerSyncAuthService';
import { TrackerSpokeSyncService } from '../../../src/services/projects-sessions/TrackerSpokeSyncService';
import { trackerFleetMachineStore } from '../../../src/services/projects-sessions/tracker-native-runtime-service/nativeTrackerLinks';
import { trackerHostLaunch } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { fixturePolicy, primary, secondary } from '../../support/trackerDispatcherFixture';
import { fixtureSecret, wire } from '../../support/trackerDispatchQueueFixture';
import { trackerResourceHoldPrefix } from '../../../src/utils/projects-sessions/trackerHostResourceHold';
import { resourceSample, runnerReport } from '../../support/trackerMachineFixture';
import { expectHubSeenBySpoke } from '../../support/trackerFleetFixture';
import {
	sweepIdleWork,
	trackerDueLaunchAction,
	verifyNeverAutoLaunch
} from '../../support/trackerDueLaunchFixture';

const signal = new AbortController().signal;
// 02:00 in Lisbon: due work launches through the night.
const night = Date.parse('2026-11-25T02:00:00Z');
const now = () => night;

function starter() {
	return vi.fn<TrackerDispatchRunner['start']>(async ({ run, key }) => ({
		type: 'session',
		session: { key, id: run.item_id, state: 'live', startedAt: night }
	}));
}

/** The due switches a host gets from a launch config that does not mention `due`. */
function defaultDue(database: DatabaseSync, node: string) {
	const store = new TrackerPersistenceService(database, node, { now });
	// Never started here. A root-owned shell passes the owner check everywhere; a CI runner's own
	// Node binary may be writable by others and is rightly refused.
	const host = trackerHostLaunch(store, { driver: '/bin/sh', repositories: {} });
	return { scheduleDue: host.scheduleDue, due: host.due };
}

function task(id: string, due: string, computer = primary) {
	return {
		itemId: id,
		fields: {
			title: id,
			kind: 'task',
			status: 'open',
			project: 'harness',
			computer,
			created_by: computer,
			due
		}
	};
}

test('the default launcher honors due times across watchdog and scheduler ticks', async () => {
	const database = new DatabaseSync(':memory:');
	const start = starter();
	let instant = night;
	const clock = () => instant;
	const runtime = new TrackerNativeRuntimeService(database, {
		node: primary,
		role: 'hub',
		now: clock,
		manualLaunch: true,
		dispatch: {
			policy: fixturePolicy(clock),
			...defaultDue(database, primary),
			runner: { start, observe: async () => undefined }
		}
	});
	try {
		const future = '2026-11-25T13:00:00.000Z';
		runtime.store.appendLocal(task('later00001', future));
		const enabled = await trackerDueLaunchAction(runtime, 'later00001', 'schedule-on');
		expect(enabled.status).toBe(200);
		instant += 120 * 60_000;
		expect.soft(await sweepIdleWork(runtime, 'later00001', signal)).toBeNull();
		runtime.store.appendLocal(task('past000001', '2026-11-24T09:00:00.000Z'));
		runtime.store.appendLocal(task('held000001', '2026-11-24T09:00:00.000Z'));
		const held = await trackerDueLaunchAction(runtime, 'held000001', 'unlaunch');
		expect(held.status).toBe(200);
		runtime.store.appendLocal(task('never00001', '2026-11-24T09:00:00.000Z'));
		await verifyNeverAutoLaunch(runtime, 'never00001', 'set');
		await runtime.scheduler!.tick(signal);
		expect
			.soft(start.mock.calls.map(([{ run }]) => [run.item_id, run.launch_source]))
			.toEqual([['past000001', 'due']]);
		instant = Date.parse(future);
		await runtime.scheduler!.tick(signal);
		expect
			.soft(start.mock.calls.map(([{ run }]) => [run.item_id, run.launch_source]))
			.toContainEqual(['later00001', 'due']);
		instant = night + 26 * 60 * 60_000;
		await runtime.scheduler!.tick(signal);
		expect(start.mock.calls.map(([{ run }]) => run.item_id)).toContain('held000001');
		expect(start.mock.calls.map(([{ run }]) => run.item_id)).not.toContain('never00001');
		expect(await sweepIdleWork(runtime, 'never00001', signal)).toBeNull();
		await verifyNeverAutoLaunch(runtime, 'never00001', 'clear');
		instant += 15_000;
		await runtime.scheduler!.tick(signal);
		expect(start.mock.calls.map(([{ run }]) => run.item_id)).toContain('never00001');
	} finally {
		database.close();
	}
});

test.each([
	{ name: 'a calm computer', reading: [1, 1, 1], ageMs: 0, starts: ['mbtwo00001'] },
	{ name: 'an overloaded computer', reading: [30, 30, 30], ageMs: 0, starts: [], fallsBack: true },
	{
		name: 'an overloaded computer with a pending request',
		reading: [30, 30, 30],
		ageMs: 0,
		starts: [],
		fallsBack: true,
		queued: true
	},
	{ name: 'a computer with a stale sample', reading: [1, 1, 1], ageMs: 180_000, starts: [] }
])(
	'the hub grants a past-due task to $name only',
	async ({ reading, ageMs, starts, fallsBack, queued }) => {
		const { hub, peer, link, machines, hubDb, peerDb, hubStart, peerStart } =
			connectDueRuntimes(fallsBack);
		try {
			const due = task('mbtwo00001', '2026-11-24T09:00:00.000Z', secondary);
			hub.store.appendLocal(
				queued
					? {
							...due,
							fields: {
								...due.fields,
								auto: 'existing-due',
								launch_source: 'due',
								launch_target: secondary
							}
						}
					: due
			);
			hub.machines.ingest([
				{ node: secondary, resources: resourceSample(night - ageMs, { load: reading }) }
			]);
			await link.pull();
			if (fallsBack) {
				await hub.scheduler!.tick(signal);
				const resources = resourceSample(night, { load: [1, 1, 1] });
				hub.machines.ingest([{ node: primary, resources }]);
				machines.record({
					node: primary,
					at: resources.at,
					resources,
					runner: { ...runnerReport(night, ['harness']), automatic_enabled: true }
				});
				await peer.telemetry!(signal);
			}
			// The spoke's link loop pushes its launch request; the hub can then authorize it.
			await peer.scheduler!.tick(signal);
			await link.push();
			await peer.scheduler!.tick(signal);
			await hub.scheduler!.tick(signal);
			expect(hubStart.mock.calls.map(([{ run }]) => run.item_id)).toEqual(
				fallsBack ? ['mbtwo00001'] : []
			);
			expect(peerStart.mock.calls.map(([{ run }]) => run.item_id)).toEqual(starts);
			hub.store.appendLocal({
				itemId: 'primary001',
				fields: { ...task('primary001', '2026-11-26T09:00:00.000Z').fields, auto: 'primary001' }
			});
			await expectHubSeenBySpoke(peer, link, night);
		} finally {
			hubDb.close();
			peerDb.close();
		}
	}
);

function connectDueRuntimes(fallsBack?: boolean) {
	const hubDb = new DatabaseSync(':memory:');
	const peerDb = new DatabaseSync(':memory:');
	const hubStart = starter();
	const peerStart = starter();
	const machines = trackerFleetMachineStore();
	const hub = new TrackerNativeRuntimeService(hubDb, {
		node: primary,
		role: 'hub',
		now,
		dispatch: {
			policy: fixturePolicy(now),
			...defaultDue(hubDb, primary),
			runner: {
				start: hubStart,
				observe: async () => undefined,
				capacity: () => runnerReport(night, ['harness']).capacity
			}
		},
		syncResponder: {
			auth: new TrackerSyncAuthService(fixtureSecret),
			machines
		}
	});
	const transport = wire(hub.sync!);
	const links = [{ secret: fixtureSecret, transport, pullWaitSeconds: 0 }];
	const peer = new TrackerNativeRuntimeService(peerDb, {
		node: secondary,
		role: 'spoke',
		now,
		links,
		dispatch: {
			policy: fixturePolicy(now, {
				node: secondary,
				admit: () => (fallsBack ? `${trackerResourceHoldPrefix}fixture load hold` : null)
			}),
			...defaultDue(peerDb, secondary),
			runner: { start: peerStart, observe: async () => undefined }
		}
	});
	const link = new TrackerSpokeSyncService({ ...links[0], store: peer.store });
	return { hub, peer, link, machines, hubDb, peerDb, hubStart, peerStart };
}
