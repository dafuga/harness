import { DatabaseSync } from 'node:sqlite';
import { onTestFinished, test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSupervisorService } from '../../../src/services/projects-sessions/TrackerSupervisorService';

test('reports node status and waits for in-flight work after cancellation', async () => {
	const database = new DatabaseSync(':memory:');
	onTestFinished(() => database.close());
	const now = () => 1780000000000;
	const runtime = new TrackerNativeRuntimeService(database, {
		node: 'fixture',
		now,
		role: 'spoke'
	});
	const abort = new AbortController();
	const blocked = Promise.withResolvers<void>();
	const entered = Promise.withResolvers<void>();
	const tick = vi.fn(async () => {
		entered.resolve();
		await blocked.promise;
		runtime.store.maxSeq();
	});
	const service = new TrackerSupervisorService(runtime, { ticks: { notifications: tick }, now });
	const running = service.run(abort.signal);
	await Promise.race([
		entered.promise,
		Promise.resolve(running).then(() => {
			throw new Error('supervisor stopped before ticking');
		})
	]);
	await expect(service.run(abort.signal)).rejects.toThrow('already running');
	expect(service.status()).toMatchObject({
		role: 'spoke',
		node: 'fixture',
		db_id: runtime.store.dbId,
		sync: { disabled: true }
	});
	abort.abort();
	const settled = vi.fn();
	void running.then(settled);
	await Promise.resolve();
	expect(settled).not.toHaveBeenCalled();
	blocked.resolve();
	await running;
	expect(tick).toHaveBeenCalledTimes(1);
});
