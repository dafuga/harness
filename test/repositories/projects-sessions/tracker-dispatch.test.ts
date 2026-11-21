import { DatabaseSync } from 'node:sqlite';
import { onTestFinished, test } from 'vitest';
import { expect } from '../../verificationExpect';
import { TrackerDispatchRepository } from '../../../src/repositories/projects-sessions/TrackerDispatchRepository';
import { TrackerRunReadRepository } from '../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerRunReceipt } from '../../../src/services/agents-providers/TrackerDispatcherService.types';
import { TrackerDispatcherService } from '../../../src/services/agents-providers/TrackerDispatcherService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import {
	fixturePolicy,
	primary,
	sampleId,
	sampleToken
} from '../../support/trackerDispatcherFixture';

test('commits one local claim and atomically rolls back an item transition with its run', async () => {
	const database = new DatabaseSync(':memory:');
	onTestFinished(() => database.close());
	const now = () => 1780000000000;
	const policy = fixturePolicy(now);
	const store = new TrackerPersistenceService(database, primary, { now });
	const repo = new TrackerDispatchRepository(store);
	const dispatcher = new TrackerDispatcherService(repo, policy);
	const second = new TrackerDispatcherService(new TrackerDispatchRepository(store), policy);
	store.appendLocal({
		itemId: sampleId,
		fields: { title: 'Fixture', kind: 'task', status: 'open' }
	});
	expect(
		await dispatcher.request(sampleId, { source: 'manual', token: sampleToken })
	).toMatchObject({ status: 'requested' });
	expect(
		database.prepare('SELECT auto, launch_target FROM items WHERE id = ?').get(sampleId)
	).toEqual({ auto: sampleToken, launch_target: primary });

	const decisions = await Promise.all([
		dispatcher.claim(sampleId, sampleToken),
		second.claim(sampleId, sampleToken)
	]);
	expect(decisions.map(({ status }) => status).sort()).toEqual(['held', 'start']);
	const [run] = repo.managedRuns();
	expect(run).toMatchObject({ id: 1, revision: 1, state: 'queued', dispatch_at: now() });
	const reads = new TrackerRunReadRepository(database, primary);
	expect(reads.list()).toMatchObject([
		{ id: 1, item_id: sampleId, auto_token: sampleToken, state: 'queued' }
	]);
	expect(() => repo.assertLegacyRollbackSafe()).toThrow(
		'Tracker rollback blocked by run 1 (queued)'
	);

	await expectAtomicRollback(database, store, repo, run);
	database.exec("UPDATE runs SET state = 'running', session_id = 'legacy-session' WHERE id = 1");
	expect(repo.managedRuns()).toEqual([]);
	expect(reads.list()).toMatchObject([{ id: 1, state: 'running', session_id: 'legacy-session' }]);
	expect(() => repo.assertLegacyRollbackSafe()).toThrow(
		'Tracker rollback blocked by run 1 (running)'
	);
	database.exec("UPDATE runs SET state = 'verifying' WHERE id = 1");
	expect(() => repo.assertLegacyRollbackSafe()).toThrow(
		'Tracker rollback blocked by run 1 (verifying)'
	);
	database.exec("UPDATE runs SET state = 'finished', outcome = 'done' WHERE id = 1");
	expect(() => repo.assertLegacyRollbackSafe()).not.toThrow();
});

async function expectAtomicRollback(
	database: DatabaseSync,
	store: TrackerPersistenceService,
	repo: TrackerDispatchRepository,
	run: TrackerRunReceipt
) {
	const seq = store.maxSeq();
	database.exec(
		"CREATE TRIGGER reject_item_update BEFORE UPDATE ON items BEGIN SELECT RAISE(ABORT, 'fixture write failed'); END"
	);
	await expect(
		repo.update(sampleId, () => ({
			result: { status: 'ignored', reason: 'fixture' },
			writes: { item: { status: 'blocked' }, runs: [{ ...run, revision: 2, state: 'finished' }] }
		}))
	).rejects.toThrow('fixture write failed');
	expect(store.maxSeq()).toBe(seq);
	expect(repo.managedRuns()).toEqual([run]);
}
