import { DatabaseSync } from 'node:sqlite';
import { expect, test, vi } from 'vitest';
import type { TrackerTmuxAdapter } from '../../../src/adapters/projects-sessions/TrackerTmuxAdapter';
import type { TrackerDispatchRunner } from '../../../src/services/projects-sessions/TrackerDispatchSchedulerService.types';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { trackerHostInventory } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostInventory';
import type { TrackerHostLaunchPort } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import type { WatchdogPane } from '../../../src/services/projects-sessions/WatchdogPaneService.types';
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

function pane(name: string, activity: number, screen: string | null = null): WatchdogPane {
	return {
		name,
		key: 'default:' + name,
		activity,
		createdAt: noon - 300 * minute,
		x: 2,
		y: 0,
		live: true,
		readable: true,
		ready: false,
		attached: false,
		runnerSocket: true,
		currentCommand: 'claude',
		screen
	};
}

test('managed sessions count pane output and live background work as activity', async () => {
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, primary, { now: () => noon });
	const names = ['auto-output-r1', 'auto-shells-r2', 'auto-silent-r3'];
	const panes = [
		pane(names[0], noon - 2 * minute),
		pane(names[1], noon - 90 * minute),
		pane(names[2], noon - 90 * minute)
	];
	const footers = new Map([
		[names[1], '❯ \n\n  ⏵⏵ bypass permissions on · 1 shell, 1 monitor'],
		[names[2], '❯ \n\n  ⏵⏵ bypass permissions on']
	]);
	const driver: TrackerHostLaunchPort = {
		inspect: async () =>
			names.map((tmux) => ({
				itemId: tmux.split('-')[1],
				key: tmux,
				id: tmux,
				tmux,
				state: 'live',
				startedAt: noon - 300 * minute
			})),
		start: async () => ({ status: 'pending' })
	};
	const tmux = {
		inventory: async () => panes,
		captured: async (seen: WatchdogPane) => ({ ...seen, screen: footers.get(seen.name) ?? null })
	} as unknown as TrackerTmuxAdapter;
	try {
		const { sessions } = await trackerHostInventory(
			{ store, driver, tmux, node: primary, keys: names, now: noon },
			signal
		);
		expect(sessions.map(({ activityAt }) => activityAt)).toEqual([
			noon - 2 * minute,
			noon,
			noon - 90 * minute
		]);
	} finally {
		database.close();
	}
});

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
