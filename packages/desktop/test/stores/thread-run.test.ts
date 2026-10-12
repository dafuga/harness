import { expect, test, vi } from 'vitest';
import { createThreadRunStore } from '../../src/lib/stores/threadRun.svelte';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
import type { RunRequest } from '../../src/models/DesktopBridge.types';

const request = {
	mode: 'plan',
	provider: 'codex',
	model: 'fixture',
	effort: null,
	entityId: 'page:a',
	threadId: 't1',
	text: 'Plan it',
	approval: null
} satisfies RunRequest;
function workspaceOf(bridge: object) {
	const refresh = vi.fn(async () => {});
	return { workspace: { bridge, refresh } as unknown as Workspace, refresh };
}

test('a run starts once, streams its public text and ends on its own events only', async () => {
	const startRun = vi.fn(async () => ({ runId: 'run-1' }));
	const { workspace, refresh } = workspaceOf({ startRun });
	const run = createThreadRunStore(workspace);
	expect(await run.start(async () => request)).toBe(true);
	expect(startRun).toHaveBeenCalledWith(request);
	expect(run.active).toBe(true);
	expect(await run.start(async () => request)).toBe(false);
	expect(startRun).toHaveBeenCalledTimes(1);
	await run.event({ runId: 'other', kind: 'text', text: 'not ours' });
	await run.event({ runId: 'run-1', kind: 'text', text: 'Working' });
	expect(run.streaming).toBe('Working');
	expect(
		await run.event({ runId: 'run-1', kind: 'finished', summary: 'Done', verified: false })
	).toBe(true);
	expect(run.status).toBe('Done');
	expect(run.active).toBe(false);
	expect(refresh).toHaveBeenCalledTimes(1);
});

test('a request that cannot be built or started reports why and starts nothing', async () => {
	const startRun = vi.fn(async () => {
		throw new Error('Provider unavailable');
	});
	const run = createThreadRunStore(workspaceOf({ startRun }).workspace);
	expect(
		await run.start(async () => {
			throw new Error('Historical views are read-only.');
		})
	).toBe(false);
	expect(startRun).not.toHaveBeenCalled();
	expect(run.error).toMatch(/read-only/);
	expect(await run.start(async () => request)).toBe(false);
	expect(run.error).toMatch(/Provider unavailable/);
	expect(run.active).toBe(false);
});

test('failure and cancellation end the run and refresh what was persisted', async () => {
	const startRun = vi.fn(async () => ({ runId: 'run-2' }));
	const cancelRun = vi.fn(async () => true);
	const { workspace, refresh } = workspaceOf({ startRun, cancelRun });
	const run = createThreadRunStore(workspace);
	await run.start(async () => request);
	await run.cancel();
	expect(cancelRun).toHaveBeenCalledWith({ runId: 'run-2' });
	await run.event({ runId: 'run-2', kind: 'cancelled' });
	expect(run.status).toBe('Run cancelled');
	expect(run.active).toBe(false);
	await run.start(async () => request);
	await run.event({ runId: 'run-2', kind: 'failed', message: 'Provider stopped' });
	expect(run.error).toBe('Provider stopped');
	expect(refresh).toHaveBeenCalledTimes(2);
});
