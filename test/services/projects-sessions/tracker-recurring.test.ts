import { DatabaseSync } from 'node:sqlite';
import { onTestFinished, test, vi } from 'vitest';
import { TrackerRecurringRepository } from '../../../src/repositories/projects-sessions/TrackerRecurringRepository';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { TrackerRecurringService } from '../../../src/services/projects-sessions/TrackerRecurringService';
import { measureWorkload } from '../../support/measureWorkload';
import { expect } from '../../verificationExpect';

const id = 'fixture001';
const epoch = Date.parse('2026-11-21T10:00:00Z');
const hour = 3600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const unit = 'service.projects-sessions-tracker-recurring';

function fixture() {
	const db = new DatabaseSync(':memory:');
	onTestFinished(() => db.close());
	let at = epoch;
	const now = () => at;
	const store = new TrackerPersistenceService(db, 'fixture-hub', { now });
	store.appendLocal({
		itemId: id,
		fields: { title: 'Recurring fixture', status: 'open', kind: 'recurring', every: '@hourly' }
	});
	return {
		db,
		store,
		now,
		advance: (ms: number) => {
			at += ms;
		}
	};
}

test('commits catch-up history with a recoverable stable wake after a queue failure', () =>
	measureWorkload(unit, 'wake-recovery', proveWakeRecovery));

async function proveWakeRecovery() {
	const { db, store, now, advance } = fixture();
	const repo = new TrackerRecurringRepository(store);
	const signal = new AbortController().signal;
	const enqueue = vi.fn().mockImplementationOnce(() => {
		throw new Error('fixture outbox failure');
	});
	await new TrackerRecurringService(repo, { now, enqueue }).tick(signal);
	advance(3 * hour);
	const service = new TrackerRecurringService(repo, { now, enqueue });
	await expect(service.tick(signal)).rejects.toThrow('fixture outbox failure');
	expect(() => repo.assertLegacyRollbackSafe()).toThrow(
		'Tracker rollback blocked by recurring work'
	);
	expect(repo.history(id)).toMatchObject([
		{ occurrence: iso(epoch + 3 * hour), status: 'pending', fired_at: iso(now()) },
		{ occurrence: iso(epoch + 2 * hour), status: 'missed', fired_at: null },
		{ occurrence: iso(epoch + hour), status: 'missed', fired_at: null }
	]);
	const highWater = store.maxSeq();
	await new TrackerRecurringService(new TrackerRecurringRepository(store), { now, enqueue }).tick(
		signal
	);
	expect(enqueue.mock.calls[0]).toEqual(enqueue.mock.calls[1]);
	expect(enqueue.mock.calls[1][0]).toMatchObject({
		key: `recurring_due|${id}|${iso(now())}`,
		payload: { next_due: iso(now() + hour), missed: [iso(now() - 2 * hour), iso(now() - hour)] }
	});
	expect(db.prepare('SELECT due, occurrence FROM items WHERE id = ?').get(id)).toEqual({
		due: iso(now() + hour),
		occurrence: iso(now())
	});
	expect(store.maxSeq()).toBe(highWater);
	expect(() => repo.assertLegacyRollbackSafe()).not.toThrow();
}

test('adopts a job result after losing the reply and wakes the owner once', () =>
	measureWorkload(unit, 'job-receipt', proveJobReceipt));

async function proveJobReceipt() {
	const { db, store, now, advance } = fixture();
	const repo = new TrackerRecurringRepository(store);
	const enqueue = vi.fn();
	const receipt = { code: 10, timedOut: false, output: 'fixture finding' };
	const start = vi.fn().mockRejectedValue(new Error('fixture lost job reply'));
	const observe = vi.fn().mockResolvedValue(receipt);
	const jobs = { start, observe };
	const signal = new AbortController().signal;
	db.prepare('INSERT INTO box_jobs (item_id, cmd, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
		id,
		'fixture descriptor',
		now(),
		now()
	);
	await new TrackerRecurringService(repo, { now, enqueue, jobs }).tick(signal);
	advance(hour);
	await expect(
		new TrackerRecurringService(repo, { now, enqueue, jobs }).tick(signal)
	).rejects.toThrow('fixture lost job reply');
	expect(repo.jobStatus()).toEqual({ jobs: 1, running: [id], queued: 0 });
	const restarted = new TrackerRecurringService(new TrackerRecurringRepository(store), {
		now,
		enqueue,
		jobs
	});
	await restarted.tick(signal);
	await restarted.tick(signal);
	expect(start).toHaveBeenCalledTimes(1);
	expect(observe).toHaveBeenCalledWith(start.mock.calls[0][0], signal);
	expect(enqueue).toHaveBeenCalledTimes(1);
	expect(enqueue.mock.calls[0][0]).toMatchObject({
		key: `recurring_due|${id}|${iso(now())}`,
		payload: {
			box_job: { exit_code: 10, timed_out: false, status: 'finding' },
			finding: 'fixture finding'
		}
	});
	expect(repo.history(id)).toMatchObject([
		{ status: 'done', by: 'box-job', note: 'box job: finding: fixture finding' }
	]);
	expect(repo.jobStatus()).toEqual({ jobs: 1, running: [], queued: 0 });
}
