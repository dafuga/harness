import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { TrackerDispatchRepository } from '../../../src/repositories/projects-sessions/TrackerDispatchRepository';
import { TrackerDispatcherService } from '../../../src/services/agents-providers/TrackerDispatcherService';
import { TrackerDispatchSchedulerService } from '../../../src/services/projects-sessions/TrackerDispatchSchedulerService';
import type { TrackerDispatchRunner } from '../../../src/services/projects-sessions/TrackerDispatchSchedulerService.types';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import {
	fixturePolicy,
	primary,
	sampleId,
	sampleToken
} from '../../support/trackerDispatcherFixture';
import { withTempDir } from '../../support/temporary';
import { provePriorityAndPacing } from '../../support/trackerDispatchQueueFixture';
import { managedRunner } from '../../support/trackerObservedRunFixture';
import { measureWorkload } from '../../support/measureWorkload';

const now = () => 1780000000000;
const policy = fixturePolicy(now);
const signal = new AbortController().signal;

function openDispatcher(path: string) {
	const database = new DatabaseSync(path);
	const store = new TrackerPersistenceService(database, primary, { now });
	const repo = new TrackerDispatchRepository(store);
	const dispatcher = new TrackerDispatcherService(repo, policy);
	return { database, store, repo, dispatcher };
}

test('adopts an uncertain start after restart without releasing the attempt twice', () =>
	measureWorkload('service.projects-sessions-tracker-dispatch-scheduler', 'managed-adoption', () =>
		withTempDir('tracker-managed-child-', async (root) => {
			await measureWorkload(
				'service.agents-providers-tracker-dispatcher',
				'stale-launch-claims',
				proveIndependentDispatch
			);
			await proveManagedAdoption(root);
			await provePriorityAndPacing();
			await proveTickRecovery();
		})
	));

async function proveTickRecovery() {
	const { store, database, repo, dispatcher } = openDispatcher(':memory:');
	let unblock!: () => void;
	const refresh = vi
		.fn<NonNullable<TrackerDispatchRunner['refresh']>>()
		.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					unblock = resolve;
				})
		)
		.mockResolvedValue(undefined);
	const start = vi.fn<TrackerDispatchRunner['start']>(async ({ key }) => ({
		type: 'session',
		session: { key, id: 'recovered', startedAt: now(), state: 'live' }
	}));
	const scheduler = new TrackerDispatchSchedulerService(repo, dispatcher, {
		policy,
		runner: { refresh, start, observe: async () => undefined }
	});
	vi.useFakeTimers();
	try {
		queueFixtureItem(store);
		const hung = scheduler.tick(signal).catch((error: unknown) => error);
		await scheduler.tick(signal);
		expect(refresh).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(120_000);
		expect(await Promise.race([hung, Promise.resolve('tick still pending')])).toMatchObject({
			message: 'dispatch tick timed out'
		});
		expect(refresh.mock.calls[0][0].aborted).toBe(true);
		expect(scheduler.runnerStatus().last_error).toBe('dispatch tick timed out');
		await scheduler.tick(signal);
		unblock();
		await vi.advanceTimersByTimeAsync(0);
		expect(start).toHaveBeenCalledTimes(1);
		expect(repo.managedRuns()).toMatchObject([{ state: 'running', session_id: 'recovered' }]);
		expect(scheduler.runnerStatus().last_error).toBeNull();
		expect(vi.getTimerCount()).toBe(0);
	} finally {
		unblock?.();
		await vi.advanceTimersByTimeAsync(0);
		vi.useRealTimers();
		database.close();
	}
}

async function proveIndependentDispatch() {
	const { store, database, repo, dispatcher } = openDispatcher(':memory:');
	const refused = 'blocked001';
	const failed = 'failed0001';
	const runnable = 'queued0001';
	let clock = now();
	const localPolicy = fixturePolicy(() => clock, {
		admit: (item) => (item.id === refused ? 'no approved repository' : null)
	});
	const localDispatcher = new TrackerDispatcherService(repo, localPolicy);
	const start = vi.fn<TrackerDispatchRunner['start']>(async ({ run, key }) => {
		if (run.item_id === failed) throw new Error('lost start reply');
		return { type: 'session', session: { key, id: 'live', startedAt: clock, state: 'live' } };
	});
	const scheduler = new TrackerDispatchSchedulerService(repo, localDispatcher, {
		policy: localPolicy,
		runner: { start, observe: async () => undefined }
	});
	try {
		const consumed = 'already000';
		queueFixtureItem(store, consumed);
		const previous = await dispatcher.claim(consumed, consumed);
		if (previous.status !== 'start') throw new Error('fixture failed to reserve a run');
		await dispatcher.record(consumed, previous.run, {
			type: 'session',
			session: { key: previous.key, id: 'existing', startedAt: clock, state: 'live' }
		});
		queueFixtureItem(store, refused);
		queueFixtureItem(store, failed);
		queueFixtureItem(store, runnable);
		queueFixtureItem(store);
		const reserved = await dispatcher.claim(sampleId, sampleToken);
		if (reserved.status !== 'start') throw new Error('fixture failed to reserve a run');
		await dispatcher.record(sampleId, reserved.run, { type: 'startup-failed', reason: 'fixture' });
		store.appendLocal({ itemId: sampleId, fields: { needs_daniel: 1, question: 'Hold fixture' } });
		clock += 6 * 60_000;
		const error = await scheduler.tick(signal).then(
			() => undefined,
			(reason: unknown) => reason
		);
		expect.soft(error).toBeUndefined();
		expect.soft(scheduler.runnerStatus().waiting[refused]).toBe('no approved repository');
		await scheduler.tick(signal);
		expect.soft(repo.readSnapshot(refused).runs).toEqual([]);
		expect.soft(repo.readSnapshot(failed).runs).toMatchObject([{ state: 'queued' }]);
		expect.soft(repo.readSnapshot(runnable).runs).toMatchObject([{ state: 'running' }]);
		expect.soft(repo.readSnapshot(sampleId)).toMatchObject({
			item: { awaitingAnswer: true, launch: null },
			runs: [{ state: 'finished' }, { state: 'finished', started_at: null }]
		});
	} finally {
		database.close();
	}
}

async function proveManagedAdoption(root: string) {
	const dbPath = join(root, 'tracker.db');
	let state = openDispatcher(dbPath);
	const fixture = managedRunner(root, () => state, now());

	const { runner } = fixture;
	try {
		queueFixtureItem(state.store);
		const scheduler = new TrackerDispatchSchedulerService(state.repo, state.dispatcher, {
			runner,
			policy
		});
		await expect.soft(scheduler.tick(signal)).resolves.toBeUndefined();
		expect(() => state.repo.assertLegacyRollbackSafe()).toThrow('(queued)');
		state.database.close();
		state = openDispatcher(dbPath);
		const restarted = new TrackerDispatchSchedulerService(state.repo, state.dispatcher, {
			runner,
			policy
		});
		runner.observe.mockResolvedValueOnce({
			type: 'session',
			session: { key: 'unrelated-key', id: 'unrelated', startedAt: now(), state: 'live' }
		});
		await restarted.tick(signal);
		expect(state.repo.managedRuns()).toMatchObject([{ state: 'queued' }]);
		await restarted.tick(signal);
		expect(state.repo.managedRuns()).toMatchObject([
			{ id: 1, state: 'running', session_id: `fixture-${fixture.child?.pid}` }
		]);
		expect(runner.start).toHaveBeenCalledTimes(1);
		expect(runner.start.mock.calls[0]).toHaveLength(3);
		const brief = String(runner.start.mock.calls[0].at(2));
		expect(brief).toContain(`tracker done ${sampleId.slice(0, 6)}`);
		expect(brief).toMatch(
			/tracker done[\s\S]+only as the final step[\s\S]+Never remove your current working directory/
		);
		expect(runner.observe.mock.calls.map(([, key]) => key)).toEqual([
			fixture.startedKey,
			fixture.startedKey
		]);
	} finally {
		fixture.child?.kill();
		await fixture.exited;
		state.database.close();
	}
}

function queueFixtureItem(store: TrackerPersistenceService, itemId = sampleId) {
	store.appendLocal({
		itemId,
		fields: {
			title: 'Fixture',
			kind: 'task',
			status: 'open',
			auto: itemId === sampleId ? sampleToken : itemId,
			computer: 'mac',
			'note+': 'auto-launch requested on mac'
		}
	});
}
