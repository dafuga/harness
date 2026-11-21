import { DatabaseSync } from 'node:sqlite';
import { test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { measureWorkload } from '../../support/measureWorkload';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSupervisorService } from '../../../src/services/projects-sessions/TrackerSupervisorService';

test('reports node status and waits for in-flight work after cancellation', async () => {
	await measureWorkload(
		'service.projects-sessions-tracker-supervisor',
		'worker-lifecycle',
		proveWorkerLifecycle
	);
});

async function proveWorkerLifecycle() {
	const database = new DatabaseSync(':memory:');
	const now = () => 1780000000000;
	const runtime = new TrackerNativeRuntimeService(database, {
		node: 'fixture',
		now,
		role: 'spoke'
	});
	const abort = new AbortController();
	const blocked = Promise.withResolvers<void>();
	const entered = Promise.withResolvers<void>();
	const adapter = vi.fn(async () => {
		entered.resolve();
		await blocked.promise;
		runtime.store.maxSeq();
	});
	const notifications = vi.fn(async () => {});
	const service = new TrackerSupervisorService(runtime, {
		ticks: { notifications, adapter },
		intervalMs: 5,
		now
	});
	const running = service.run(abort.signal);
	try {
		await entered.promise;
		await expect(service.run(abort.signal)).rejects.toThrow('already running');
		expect(service.status()).toMatchObject({
			role: 'spoke',
			node: 'fixture',
			db_id: runtime.store.dbId,
			sync: { disabled: true }
		});
		await vi.waitFor(() => expect(notifications.mock.calls.length).toBeGreaterThan(1));
		expect(adapter).toHaveBeenCalledTimes(1);
		abort.abort();
		const settled = vi.fn();
		void running.then(settled);
		await Promise.resolve();
		expect(settled).not.toHaveBeenCalled();
	} finally {
		abort.abort();
		blocked.resolve();
		await running;
		database.close();
	}
	expect(adapter).toHaveBeenCalledTimes(1);
}
