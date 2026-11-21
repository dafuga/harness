import { DatabaseSync } from 'node:sqlite';
import { onTestFinished, test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { TrackerDispatchRepository } from '../../../src/repositories/projects-sessions/TrackerDispatchRepository';
import { TrackerDispatcherService } from '../../../src/services/agents-providers/TrackerDispatcherService';
import { TrackerDispatchSchedulerService } from '../../../src/services/projects-sessions/TrackerDispatchSchedulerService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import {
	fixturePolicy,
	primary,
	sampleId,
	sampleToken
} from '../../support/trackerDispatcherFixture';

test('adopts an uncertain start after restart without releasing the attempt twice', async () => {
	const database = new DatabaseSync(':memory:');
	onTestFinished(() => database.close());
	const now = () => 1780000000000;
	const policy = fixturePolicy(now);
	const store = new TrackerPersistenceService(database, primary, { now });
	const repo = new TrackerDispatchRepository(store);
	const dispatcher = new TrackerDispatcherService(repo, policy);
	store.appendLocal({
		itemId: sampleId,
		fields: { title: 'Fixture', kind: 'task', status: 'open' }
	});
	await dispatcher.request(sampleId, { source: 'manual', token: sampleToken });
	let key = '';
	const runner = {
		start: vi.fn(async (reservation: { key: string }) => {
			expect(repo.managedRuns()).toMatchObject([{ state: 'queued', dispatch_at: now() }]);
			key = reservation.key;
			throw new Error('lost start reply');
		}),
		observe: vi.fn(async () => ({
			type: 'session' as const,
			session: { key, id: 'fixture-session', startedAt: now(), state: 'live' as const }
		}))
	};

	const signal = new AbortController().signal;
	await expect(
		new TrackerDispatchSchedulerService(repo, dispatcher, { runner }).tick(signal)
	).rejects.toThrow('lost start reply');
	expect(repo.managedRuns()).toMatchObject([{ state: 'queued' }]);
	const restarted = new TrackerDispatchSchedulerService(repo, dispatcher, { runner });
	await restarted.tick(signal);
	expect(repo.managedRuns()).toMatchObject([
		{ id: 1, state: 'running', session_id: 'fixture-session' }
	]);
	await restarted.tick(signal);
	expect(runner.start).toHaveBeenCalledTimes(1);
});
