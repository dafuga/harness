import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSyncAuthService } from '../../src/services/networking-security/TrackerSyncAuthService';
import { trackerFleetMachineStore } from '../../src/services/projects-sessions/tracker-native-runtime-service/nativeTrackerLinks';
import { trackerHostCapacityHold } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostAdmission';
import type { TrackerHubSyncService } from '../../src/services/projects-sessions/TrackerHubSyncService';
import type { TrackerSpokeTransport } from '../../src/services/projects-sessions/TrackerSpokeSyncService.types';
import { DatabaseSync } from 'node:sqlite';
import { vi } from 'vitest';
import { expect } from '../verificationExpect';
import { TrackerDispatchRepository } from '../../src/repositories/projects-sessions/TrackerDispatchRepository';
import { TrackerDispatcherService } from '../../src/services/agents-providers/TrackerDispatcherService';
import { TrackerDispatchSchedulerService } from '../../src/services/projects-sessions/TrackerDispatchSchedulerService';
import { TrackerPersistenceService } from '../../src/services/projects-sessions/TrackerPersistenceService';
import type {
	TrackerDispatchRunner,
	TrackerReservedStart
} from '../../src/services/projects-sessions/TrackerDispatchSchedulerService.types';
import { fixturePolicy, primary, secondary } from './trackerDispatcherFixture';

const signal = new AbortController().signal;
export async function provePriorityAndPacing() {
	let clock = Date.parse('2026-11-25T07:59:59Z');
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, primary, { now: () => clock });
	const repo = new TrackerDispatchRepository(store);
	let enabled = false;
	const localPolicy = fixturePolicy(() => clock, { automaticEnabled: () => enabled });
	const dispatcher = new TrackerDispatcherService(repo, localPolicy);
	const start = vi.fn<TrackerDispatchRunner['start']>(async ({ run, key }) => ({
		type: 'session',
		session: { key, id: run.item_id, startedAt: clock, state: 'live' }
	}));
	const stop = vi.fn(async () => true);
	const options = {
		policy: localPolicy,
		permitAutomatic: () => repo.launches.reserveAutomaticSlot(clock),
		runner: { start, stop, observe: async () => undefined }
	};
	const create = () => new TrackerDispatchSchedulerService(repo, dispatcher, options);
	try {
		queueAutomatic(store);
		const scheduler = create();
		queueExplicit(store, 'manual0001');
		await scheduler.tick(signal);
		expect(start.mock.calls.map(([{ run }]) => run.item_id)).toEqual(['manual0001']);
		expect(scheduler.status().enabled).toBe(false);
		enabled = true;
		await scheduler.tick(signal);
		expect(start).toHaveBeenCalledTimes(1);
		expect(scheduler.runnerStatus().waiting_on).toBe('automatic launch night hold');

		clock += 1000;
		queueExplicit(store, 'manual0002');
		await scheduler.tick(signal);
		await scheduler.tick(signal);
		await scheduler.tick(signal);
		await create().tick(signal);
		expect(start.mock.calls.map(([{ run }]) => run.item_id)).toEqual([
			'manual0001',
			'manual0002',
			'auto000003',
			'auto000001'
		]);
		clock += 59_999;
		await create().tick(signal);
		expect(start).toHaveBeenCalledTimes(4);
		clock++;
		await create().tick(signal);
		expect(start).toHaveBeenCalledTimes(5);
		await proveStop({ scheduler, dispatcher, repo, stop }, start.mock.calls.at(-1)![0]);
	} finally {
		database.close();
	}
}

async function proveStop(
	{
		scheduler,
		dispatcher,
		repo,
		stop
	}: {
		scheduler: TrackerDispatchSchedulerService;
		dispatcher: TrackerDispatcherService;
		repo: TrackerDispatchRepository;
		stop: ReturnType<typeof vi.fn>;
	},
	last: TrackerReservedStart
) {
	const reservation = last;
	const { id, item_id: itemId } = reservation.run;
	expect(await scheduler.stop('#' + id, signal)).toMatchObject({
		id: itemId,
		schedule_off: true,
		auto: null
	});
	expect(stop).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id }), signal);
	expect(repo.readSnapshot(itemId).runs).toMatchObject([
		{ id, state: 'finished', outcome: 'abandoned', failure_reason: 'stopped by operator' }
	]);
	await expect(
		dispatcher.request(itemId, {
			source: 'recovery',
			token: 'stopped',
			expectedAuto: null
		})
	).resolves.toMatchObject({ status: 'ignored' });
}

function queueAutomatic(store: TrackerPersistenceService) {
	for (const id of ['auto000001', 'auto000002', 'auto000003']) {
		store.appendLocal({
			itemId: id,
			fields: {
				title: id,
				kind: 'task',
				status: 'open',
				auto: id,
				computer: 'mac',
				launch_source: 'manual',
				due: '2026-11-24',
				...(id === 'auto000003' && { adapter_due_owner: primary, priority: 'urgent' }),
				...(id === 'auto000002' && { priority: 'low' })
			}
		});
	}
}

function queueExplicit(store: TrackerPersistenceService, itemId: string) {
	store.appendLocal({
		itemId,
		fields: {
			title: itemId,
			kind: 'task',
			status: 'open',
			auto: itemId,
			launch_source: 'manual',
			computer: 'mac',
			'note+': 'auto-launch requested on mac'
		}
	});
}

export const fixtureSecret = 'synthetic-tracker-wire-secret';

export function configuredIntakePair(
	{ hubDb, peerDb, now }: { hubDb: DatabaseSync; peerDb: DatabaseSync; now: () => number },
	{
		hubStart,
		started
	}: { hubStart: TrackerDispatchRunner['start']; started: TrackerDispatchRunner['start'] }
) {
	const hub = new TrackerNativeRuntimeService(hubDb, {
		node: primary,
		role: 'hub',
		now,
		dispatch: {
			policy: fixturePolicy(now, {
				admit: () => trackerHostCapacityHold,
				pickModel: () => ({
					rung: { id: 'sol', cli: 'codex', model: 'gpt-6.2-sol' },
					kind: 'coding',
					reason: 'tester intake'
				})
			}),
			scheduleDue: true,
			due: () => ({ enabled: false, paused: false, adapterDue: true, localDue: true }),
			runner: { start: hubStart, observe: async () => undefined }
		},
		syncResponder: {
			auth: new TrackerSyncAuthService(fixtureSecret),
			machines: trackerFleetMachineStore()
		}
	});
	const transport = wire(hub.sync!);
	const peer = new TrackerNativeRuntimeService(peerDb, {
		node: secondary,
		role: 'spoke',
		now,
		dispatch: {
			policy: fixturePolicy(now),
			due: () => ({ enabled: false, paused: false, localDue: true }),
			runner: {
				start: started,
				capacity: () => ({ freeSlots: 1, projects: { buildflexity: { freeGB: 60, freePct: 8 } } }),
				observe: async () => undefined
			}
		},
		links: [{ secret: fixtureSecret, transport, pullWaitSeconds: 0 }]
	});

	return { hub, peer, transport };
}

export function wire(hub: TrackerHubSyncService): TrackerSpokeTransport {
	return async (request) => {
		const data = new Request('http://tracker-fixture.invalid' + request.pathAndQuery, {
			method: request.method,
			headers: request.headers,
			body: request.body
		});
		const response = await hub.handle({
			method: request.method,
			pathAndQuery: request.pathAndQuery,
			headers: data.headers,
			body: data.body
		});
		if (!response.ok) throw new Error(`Fixture sync failed with status ${response.status}`);
		return await response.json();
	};
}
