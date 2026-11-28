import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { TrackerItemReadRepository } from '../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { expect } from 'vitest';
import type { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { managedTrackerItemRequest } from './trackerManagedProcessFixture';

const minute = 60_000;

export async function verifyStoppedRun(
	runtime: TrackerNativeRuntimeService,
	{
		dispatch,
		tmux,
		watchdog
	}: {
		dispatch: () => Promise<void>;
		tmux: (...args: string[]) => string;
		watchdog: (delay: number) => Promise<void>;
	}
) {
	// Reuse the existing isolated session check with a new, known-owned worker.
	const itemId = 'stop000001';
	seedTask(runtime, Date.now(), itemId);
	expect((await managedTrackerItemRequest(runtime, itemId, 'launch')).ok).toBe(true);
	await dispatch();
	expect((await managedTrackerItemRequest(runtime, itemId, 'start')).ok).toBe(true);
	const row = runtime.store.database
		.prepare("SELECT id, tmux FROM runs WHERE item_id = ? AND state = 'running'")
		.get(itemId) as { id: number; tmux: string };
	await expect(
		runtime.scheduler!.stop('#' + row.id, new AbortController().signal)
	).resolves.toMatchObject({
		id: itemId,
		auto: null,
		schedule_off: true
	});
	expect(() => tmux('has-session', '-t', '=' + row.tmux)).toThrow();
	await watchdog(11 * minute);
	expect(
		runtime.store.database
			.prepare('SELECT status, blocked_reason FROM items WHERE id = ?')
			.get(itemId)
	).toMatchObject({
		status: 'open',
		blocked_reason: null
	});
	expect(
		runtime.store.database
			.prepare('SELECT state, failure_reason FROM runs WHERE id = ?')
			.get(row.id)
	).toEqual({ state: 'finished', failure_reason: 'stopped by operator' });
}

export async function verifyKilledReminder(
	runtime: TrackerNativeRuntimeService,
	{
		dispatch,
		tmux,
		watchdog
	}: {
		dispatch: () => Promise<void>;
		tmux: (...args: string[]) => string;
		watchdog: (delay: number) => Promise<void>;
	}
) {
	const itemId = 'remind1234';
	seedTask(runtime, Date.now(), itemId);
	expect((await managedTrackerItemRequest(runtime, itemId, 'launch')).ok).toBe(true);
	await dispatch();
	expect((await managedTrackerItemRequest(runtime, itemId, 'start')).ok).toBe(true);
	const db = runtime.store.database;
	const run = db
		.prepare("SELECT tmux FROM runs WHERE item_id = ? AND state = 'running'")
		.get(itemId) as { tmux: string };
	const response = await runtime.items.handle(
		new Request('http://tracker-fixture.invalid/items/' + itemId + '/remind', {
			method: 'POST',
			body: JSON.stringify({ at: new Date(Date.now() + 2 * minute).toISOString(), reminder: true })
		})
	);
	expect(await response.json()).toMatchObject({ kind: 'reminder', auto: null });
	tmux('kill-session', '-t', '=' + run.tmux);
	await watchdog(11 * minute);
	await watchdog(minute);
	expect(db.prepare('SELECT state FROM runs WHERE item_id = ?').all(itemId)).toEqual([
		{ state: 'finished' }
	]);
	expect((await managedTrackerItemRequest(runtime, itemId, 'launch')).status).toBe(409);
}

export function seedTask(runtime: TrackerNativeRuntimeService, now: number, itemId: string) {
	runtime.store.appendLocal({
		itemId,
		fields: {
			title: 'Synthetic recovery task',
			notes: 'Resume the synthetic task.',
			'note+': 'stopped: reboot; resume from: checkpoint commit',
			status: 'open',
			kind: 'task',
			model: 'gpt-6.1-terra:high',
			project: 'Harness',
			due: new Date(now + 120 * minute).toISOString()
		}
	});
}

export async function verifyFailureBudget({
	watchdog,
	items,
	database,
	id
}: {
	watchdog: (delay: number) => Promise<void>;
	items: TrackerItemReadRepository;
	database: DatabaseSync;
	id: string;
}) {
	for (let step = 0; step < 4; step++) {
		await watchdog(11 * minute);
		expect(items.getStored(id).needs_daniel).toBe(false);
	}
	await watchdog(11 * minute);
	// The item is held as blocked for Chief of Staff; Daniel is not asked.
	expect(items.getStored(id)).toMatchObject({
		needs_daniel: false,
		status: 'blocked',
		blocked_reason: expect.stringMatching(/3.*relaunch/i)
	});
	const count = database.prepare('SELECT COUNT(*) AS total FROM runs').get();
	await watchdog(11 * minute);
	expect(database.prepare('SELECT COUNT(*) AS total FROM runs').get()).toEqual(count);
	expect(
		items.getStored(id).notes_log.filter(({ text }) => text.includes('watchdog recovery-failed'))
	).toHaveLength(1);
}

export function verifyResumeBrief(directory: string, run: number) {
	const brief = readBrief(directory, run);
	expect(brief).toContain('Resume the synthetic task');
	expect(brief).toContain('Progress note 11');
	expect(brief).toContain('resume from: checkpoint commit');
}

function readBrief(state: string, run: number) {
	for (const attempt of readdirSync(state)) {
		const receipt = join(state, attempt, 'receipt.json');
		if (existsSync(receipt) && JSON.parse(readFileSync(receipt, 'utf8')).runId === run)
			return readFileSync(join(state, attempt, 'brief.md'), 'utf8');
	}
	return '';
}
