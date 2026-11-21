import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { expect, test, vi } from 'vitest';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { TrackerSpokeLoopService } from '../../../src/services/projects-sessions/TrackerSpokeLoopService';
import type { TrackerSpokeOperation } from '../../../src/services/projects-sessions/TrackerSpokeSyncService.types';

test('flushes a committed write, retries its lost receipt and cancels the outstanding pull on stop', async () => {
	const db = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(db, 'fixture-spoke');
	const abort = new AbortController();
	const errors = vi.fn();
	const operations = new Set<string>();
	let pushAttempts = 0;
	let pullAborted = false;
	const loop = new TrackerSpokeLoopService({
		store,
		secret: 'synthetic-spoke-loop-key',
		pushIntervalMs: 10,
		onError: errors,
		transport: async (request, signal) => {
			if (request.method === 'GET') {
				await once(signal, 'abort');
				pullAborted = true;
				throw signal.reason;
			}
			const body = JSON.parse(request.body ?? '') as { ops: TrackerSpokeOperation[] };
			for (const op of body.ops) operations.add(op.op_id);
			if (++pushAttempts === 1) throw new Error('fixture dropped receipt');
			return { ok: true, db_id: 'fixture-hub' };
		}
	});
	const running = loop.run(abort.signal);
	try {
		await expect(loop.run(abort.signal)).rejects.toThrow(/already running/);
		const op = store.appendLocal({ itemId: 'fixture-item', fields: { title: 'Fixture commit' } });
		await vi.waitFor(() => expect(store.getMeta('pushed_seq')).toBe('1'), {
			interval: 5,
			timeout: 500
		});
		expect(operations).toEqual(new Set([op.op_id]));
		expect(pushAttempts).toBe(2);
		expect(errors).toHaveBeenCalledTimes(1);
	} finally {
		abort.abort();
		await running;
		db.close();
	}
	expect(pullAborted).toBe(true);
});
