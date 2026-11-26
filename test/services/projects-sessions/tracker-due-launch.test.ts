import { DatabaseSync } from 'node:sqlite';
import { test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import type { TrackerDispatchRunner } from '../../../src/services/projects-sessions/TrackerDispatchSchedulerService.types';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSyncAuthService } from '../../../src/services/networking-security/TrackerSyncAuthService';
import { TrackerSpokeSyncService } from '../../../src/services/projects-sessions/TrackerSpokeSyncService';
import { trackerFleetMachineStore } from '../../../src/services/projects-sessions/tracker-native-runtime-service/nativeTrackerLinks';
import { trackerSupervisorStatus } from '../../../src/services/projects-sessions/tracker-supervisor-service/trackerSupervisorStatus';
import { trackerHostLaunch } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { fixturePolicy, primary, secondary } from '../../support/trackerDispatcherFixture';
import { fixtureSecret, wire } from '../../support/trackerDispatchQueueFixture';
import { resourceSample } from '../../support/trackerMachineFixture';

const signal = new AbortController().signal;
const noon = Date.parse('2026-11-25T12:00:00Z');
const now = () => noon;

function starter() {
	return vi.fn<TrackerDispatchRunner['start']>(async ({ run, key }) => ({
		type: 'session',
		session: { key, id: run.item_id, state: 'live', startedAt: noon }
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

test('a past-due task launches within one scheduler tick on the default launch config', async () => {
	const database = new DatabaseSync(':memory:');
	const start = starter();
	const runtime = new TrackerNativeRuntimeService(database, {
		node: primary,
		role: 'hub',
		now,
		dispatch: {
			policy: fixturePolicy(now),
			...defaultDue(database, primary),
			runner: { start, observe: async () => undefined }
		}
	});
	try {
		runtime.store.appendLocal(task('later00001', '2026-11-25T13:00:00.000Z'));
		runtime.store.appendLocal(task('past000001', '2026-11-24T09:00:00.000Z'));
		await runtime.scheduler!.tick(signal);
		expect(start.mock.calls.map(([{ run }]) => [run.item_id, run.launch_source])).toEqual([
			['past000001', 'due']
		]);
	} finally {
		database.close();
	}
});

test.each([
	{ name: 'a calm computer', reading: [1, 1, 1], ageMs: 0, starts: ['mbtwo00001'] },
	{ name: 'an overloaded computer', reading: [30, 30, 30], ageMs: 0, starts: [] },
	{ name: 'a computer with a stale sample', reading: [1, 1, 1], ageMs: 180_000, starts: [] }
])('the hub grants a past-due task to $name only', async ({ reading, ageMs, starts }) => {
	const hubDb = new DatabaseSync(':memory:');
	const peerDb = new DatabaseSync(':memory:');
	const hubStart = starter();
	const peerStart = starter();
	const hub = new TrackerNativeRuntimeService(hubDb, {
		node: primary,
		role: 'hub',
		now,
		dispatch: {
			policy: fixturePolicy(now),
			...defaultDue(hubDb, primary),
			runner: { start: hubStart, observe: async () => undefined }
		},
		syncResponder: {
			auth: new TrackerSyncAuthService(fixtureSecret),
			machines: trackerFleetMachineStore()
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
			policy: fixturePolicy(now, { node: secondary }),
			...defaultDue(peerDb, secondary),
			runner: { start: peerStart, observe: async () => undefined }
		}
	});
	try {
		hub.store.appendLocal(task('mbtwo00001', '2026-11-24T09:00:00.000Z', secondary));
		hub.machines.ingest([
			{ node: secondary, resources: resourceSample(noon - ageMs, { load: reading }) }
		]);
		const link = new TrackerSpokeSyncService({ ...links[0], store: peer.store });
		await link.pull();
		// The spoke's link loop pushes its launch request; the hub can then authorize it.
		await peer.scheduler!.tick(signal);
		await link.push();
		await peer.scheduler!.tick(signal);
		await hub.scheduler!.tick(signal);
		expect(hubStart).not.toHaveBeenCalled();
		expect(peerStart.mock.calls.map(([{ run }]) => run.item_id)).toEqual(starts);
		await expectHubSeenBySpoke(hub, peer, link);
	} finally {
		hubDb.close();
		peerDb.close();
	}
});

/** A spoke describes the hub from the hub's own report, as it does any other computer. */
async function expectHubSeenBySpoke(
	hub: TrackerNativeRuntimeService,
	peer: TrackerNativeRuntimeService,
	link: TrackerSpokeSyncService
) {
	hub.store.appendLocal({
		itemId: 'primary001',
		fields: { ...task('primary001', '2026-11-26T09:00:00.000Z').fields, auto: 'primary001' }
	});
	await link.pull();
	await peer.telemetry!(signal);
	const request = new Request('http://tracker-fixture.invalid/items/primary001');
	expect(await (await peer.items.handle(request)).json()).toMatchObject({
		launch_status: { computer: primary, reason: `queued on ${primary}` }
	});
	expect(trackerSupervisorStatus(peer, new Date(noon).toISOString()).autolaunch.computers).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				computer: primary,
				state: 'polling',
				last_tick_at: new Date(noon).toISOString()
			})
		])
	);
}
