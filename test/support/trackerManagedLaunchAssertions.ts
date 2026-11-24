import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { expect, vi } from 'vitest';
import { trackerManagedToken } from '../../src/adapters/projects-sessions/tracker-tmux-adapter/trackerManagedLaunchReceipt';
import type { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { managedTrackerItemRequest } from './trackerManagedProcessFixture';

export async function verifyCancelledClaim(
	runtime: TrackerNativeRuntimeService,
	database: DatabaseSync,
	attempts: string,
	itemId: string
) {
	const tick = () => runtime.scheduler!.tick(new AbortController().signal);
	expect((await managedTrackerItemRequest(runtime, itemId, 'done')).ok).toBe(true);
	await tick();
	for (const action of ['reopen', 'unlaunch', 'launch'])
		expect((await managedTrackerItemRequest(runtime, itemId, action)).ok).toBe(true);
	const token = database.prepare('SELECT auto FROM items WHERE id = ?').get(itemId)!.auto;
	const directory = join(
		attempts,
		trackerManagedToken(runtime.store.node, JSON.stringify([itemId, token, 1]))
	);
	mkdirSync(directory, { mode: 0o700 });
	await tick();
	const runs = () =>
		database
			.prepare('SELECT id,state,outcome,started_at FROM runs WHERE id >= 4 ORDER BY id')
			.all();
	const held = [{ id: 4, state: 'queued', outcome: null, started_at: null }];
	expect(runs()).toEqual(held);
	expect((await managedTrackerItemRequest(runtime, itemId, 'unlaunch')).ok).toBe(true);
	expect((await managedTrackerItemRequest(runtime, itemId, 'launch')).ok).toBe(true);
	expect(database.prepare('SELECT auto FROM items WHERE id = ?').get(itemId)!.auto).not.toBe(token);
	await tick();
	expect(runs()).toEqual(held);
	const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60_000);
	const probe = join(attempts, '..', 'tmux-presence');
	try {
		for (const reply of ['tmux inventory permission denied', 'HARNESS_TRACKER_ATTEMPT=live']) {
			writeFileSync(probe, reply);
			await tick();
			expect(runs()).toEqual(held);
		}
		unlinkSync(probe);
		const marker = join(directory, 'started.tmp');
		writeFileSync(marker, 'synthetic partial startup marker', { mode: 0o600 });
		await tick();
		expect(runs()).toEqual(held);
		unlinkSync(marker);
		await tick();
		expect(runs()).toEqual([
			{ id: 4, state: 'finished', outcome: 'abandoned', started_at: null },
			{ id: 5, state: 'running', outcome: null, started_at: expect.any(Number) }
		]);
		expect((await managedTrackerItemRequest(runtime, itemId, 'done')).ok).toBe(true);
		await tick();
		expect(runs()).toHaveLength(2);
	} finally {
		clock.mockRestore();
	}
}

export async function verifyExpiredClaim(
	runtime: TrackerNativeRuntimeService,
	database: DatabaseSync,
	attempts: string,
	itemId: string
) {
	const tick = () => runtime.scheduler!.tick(new AbortController().signal);
	for (const action of ['reopen', 'unlaunch', 'launch'])
		expect((await managedTrackerItemRequest(runtime, itemId, action)).ok).toBe(true);
	const token = database.prepare('SELECT auto FROM items WHERE id = ?').get(itemId)!.auto;
	mkdirSync(
		join(attempts, trackerManagedToken(runtime.store.node, JSON.stringify([itemId, token, 1]))),
		{
			mode: 0o700
		}
	);
	await tick();
	const runs = () =>
		database.prepare('SELECT id,state,attempt,started_at FROM runs WHERE id >= 6').all();
	expect(runs()).toEqual([{ id: 6, state: 'queued', attempt: 1, started_at: null }]);
	const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60_000);
	try {
		await tick();
		await tick();
		expect(runs()).toEqual([
			{ id: 6, state: 'finished', attempt: 1, started_at: null },
			{ id: 7, state: 'running', attempt: 2, started_at: expect.any(Number) }
		]);
	} finally {
		clock.mockRestore();
	}
}
