import { DatabaseSync } from 'node:sqlite';
import { expect, test, vi } from 'vitest';
import type { TrackerDispatchRunner } from '../../../src/services/projects-sessions/TrackerDispatchSchedulerService.types';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { trackerHostRunner } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostRunner';
import { readWatchdogAlerts } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostWatchdogState';
import type { TrackerHostLaunchPort } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import {
	dispatcherFixture,
	fixturePolicy,
	primary,
	runFixture,
	sampleId
} from '../../support/trackerDispatcherFixture';

const signal = new AbortController().signal;
const noon = Date.parse('2026-11-25T12:00:00Z');
const minute = 60_000;

function launchRuntime(database: DatabaseSync, clock: { now: number }) {
	const start = vi.fn<TrackerDispatchRunner['start']>(async ({ run, key }) => ({
		type: 'session',
		session: { key, id: run.item_id, state: 'live', startedAt: clock.now }
	}));
	const overdue = vi.fn();
	const runtime = new TrackerNativeRuntimeService(database, {
		node: primary,
		role: 'hub',
		now: () => clock.now,
		manualLaunch: true,
		dispatch: {
			policy: fixturePolicy(() => clock.now),
			runner: {
				start,
				overdue,
				observe: async () => ({ type: 'monitor', session: 'live' })
			}
		}
	});
	return { runtime, start, overdue };
}

const itemId = 'live000001';

function seed(runtime: TrackerNativeRuntimeService) {
	runtime.store.appendLocal({
		itemId,
		fields: {
			title: itemId,
			kind: 'task',
			status: 'open',
			project: 'harness',
			computer: primary,
			auto: 'live-token',
			launch_source: 'manual',
			launch_target: primary
		}
	});
}

function runRows(database: DatabaseSync) {
	return database.prepare('SELECT attempt, state, outcome FROM runs ORDER BY id').all();
}

test('the scheduler reports an overdue live run without ending it or starting another', async () => {
	const database = new DatabaseSync(':memory:');
	const clock = { now: noon };
	const { runtime, start, overdue } = launchRuntime(database, clock);
	try {
		seed(runtime);
		await runtime.scheduler!.tick(signal);
		clock.now += 600 * minute;
		await runtime.scheduler!.tick(signal);
		expect(start).toHaveBeenCalledTimes(1);
		expect(runRows(database)).toEqual([{ attempt: 1, state: 'running', outcome: null }]);
		expect(overdue).toHaveBeenCalledWith(
			expect.objectContaining({ item_id: itemId }),
			'ran past the 480 min cap; its session is still alive'
		);
	} finally {
		database.close();
	}
});

test('the host raises one Chief of Staff alert for an overdue run', async () => {
	const database = new DatabaseSync(':memory:');
	const { runtime } = launchRuntime(database, { now: noon });
	try {
		seed(runtime);
		const driver: TrackerHostLaunchPort = {
			inspect: async () => [],
			start: async () => ({ status: 'pending' })
		};
		const { runner } = trackerHostRunner(runtime.store, driver, () => undefined, {
			now: () => noon
		});
		const { run } = await runFixture(dispatcherFixture());
		const overdue = { ...run, item_id: itemId };
		runner.overdue(overdue, 'fixture is overdue');
		runner.overdue(overdue, 'fixture is overdue');
		expect(Object.values(readWatchdogAlerts(runtime.store))).toMatchObject([
			{ kind: 'overdue', item_id: itemId }
		]);
		expect(
			runtime.store.database.prepare('SELECT text FROM item_notes WHERE item_id = ?').all(itemId)
		).toEqual([
			{
				text: `watchdog overdue: Run #${run.id} fixture is overdue. No retry is queued. Check the session, or end it with \`tracker stop live00\`.`
			}
		]);
	} finally {
		database.close();
	}
});

test('unlaunch cancels a queued run that has not started in the same write', async () => {
	const database = new DatabaseSync(':memory:');
	const clock = { now: noon };
	const { runtime, start } = launchRuntime(database, clock);
	start.mockResolvedValueOnce({ type: 'startup-failed', reason: 'fixture start failure' });
	try {
		seed(runtime);
		await runtime.scheduler!.tick(signal);
		expect(runRows(database)).toEqual([
			{ attempt: 1, state: 'finished', outcome: 'abandoned' },
			{ attempt: 2, state: 'queued', outcome: null }
		]);
		const response = await runtime.items.handle(
			new Request(`http://tracker-fixture.invalid/items/${itemId}/unlaunch`, {
				method: 'POST',
				body: '{}'
			})
		);
		expect(response.status).toBe(200);
		expect(
			database.prepare('SELECT state, outcome, failure_reason FROM runs WHERE attempt = 2').get()
		).toEqual({
			state: 'finished',
			outcome: 'abandoned',
			failure_reason: 'launch cancelled before startup'
		});
	} finally {
		database.close();
	}
});

test('pending human review suppresses an ETA stall until the hard cap', async () => {
	const fixture = dispatcherFixture({
		policy: { defaultEtaMinutes: 3, stallMinutes: 2, maxRunMinutes: 10 }
	});
	const { run } = await runFixture(fixture);
	const { service, advance, changeItem } = fixture;
	const monitor = { type: 'monitor', session: 'live', idleReview: true } as const;
	changeItem({ awaitingAnswer: true });
	advance(5 * 60_000);
	expect(await service.record(sampleId, run, monitor)).toEqual({
		status: 'held',
		reason: 'run still active'
	});
	advance(6 * 60_000);
	expect(await service.record(sampleId, run, monitor)).toEqual({
		status: 'held',
		reason: 'ran past the 10 min cap; its session is still alive'
	});
});
