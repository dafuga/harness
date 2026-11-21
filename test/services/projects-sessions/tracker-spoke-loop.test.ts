import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { expect, test, vi } from 'vitest';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { TrackerSpokeLoopService } from '../../../src/services/projects-sessions/TrackerSpokeLoopService';
import type { TrackerSpokeLoopOptions } from '../../../src/services/projects-sessions/TrackerSpokeLoopService.types';
import type { TrackerSpokeOperation } from '../../../src/services/projects-sessions/TrackerSpokeSyncService.types';

test('flushes a committed write, retries its lost receipt and cancels the outstanding pull on stop', async () => {
	const db = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(db, 'fixture-spoke');
	const abort = new AbortController();
	const errors = vi.fn();
	const fixture = spokeTransport();
	const loop = new TrackerSpokeLoopService({
		store,
		secret: 'synthetic-spoke-loop-key',
		pushIntervalMs: 10,
		onError: errors,
		transport: fixture.transport
	});
	const running = loop.run(abort.signal);
	try {
		await expect(loop.run(abort.signal)).rejects.toThrow(/already running/);
		const op = store.appendLocal({ itemId: 'fixture-item', fields: { title: 'Fixture commit' } });
		await vi.waitFor(() => expect(errors).toHaveBeenCalledTimes(1));
		expect(loop.status()).toMatchObject({
			connected: false,
			pending_push: 1,
			lastError: 'push failed'
		});
		fixture.allowReceipt.resolve();
		await vi.waitFor(() => expect(store.getMeta('pushed_seq')).toBe('1'), {
			interval: 5,
			timeout: 500
		});
		expect(fixture.operations).toEqual(new Set([op.op_id]));
		expect(fixture.state.pushAttempts).toBe(2);
		expect(errors).toHaveBeenCalledTimes(1);
		fixture.allowPull.resolve();
		await vi.waitFor(() =>
			expect(loop.status()).toMatchObject({
				connected: true,
				pending_push: 0,
				lastError: null,
				lastPullOk: expect.any(String),
				lastPushOk: expect.any(String)
			})
		);
	} finally {
		abort.abort();
		fixture.allowReceipt.resolve();
		fixture.allowPull.resolve();
		await running;
		db.close();
	}
	expect(fixture.state.pullAborted).toBe(true);
});

function spokeTransport() {
	const operations = new Set<string>();
	const allowReceipt = Promise.withResolvers<void>();
	const allowPull = Promise.withResolvers<void>();
	const state = { pushAttempts: 0, pullAborted: false };
	let pullAttempts = 0;
	const transport: TrackerSpokeLoopOptions['transport'] = async (request, signal) => {
		if (request.method === 'GET') {
			if (++pullAttempts === 1) {
				await allowPull.promise;
				return { hub: 'fixture-hub', db_id: 'fixture-hub', ops: [], max: 0, last: 0 };
			}
			await once(signal, 'abort');
			state.pullAborted = true;
			throw signal.reason;
		}
		const body = JSON.parse(request.body ?? '') as { ops: TrackerSpokeOperation[] };
		for (const op of body.ops) operations.add(op.op_id);
		if (++state.pushAttempts === 1) throw new Error('fixture dropped receipt');
		await allowReceipt.promise;
		return { ok: true, db_id: 'fixture-hub' };
	};
	return { transport, state, operations, allowReceipt, allowPull };
}
