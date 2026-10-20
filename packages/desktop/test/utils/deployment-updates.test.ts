import { expect, test, vi } from 'vitest';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
import { deploymentUpdates } from '../../src/utils/deploymentUpdates';

test('progress ignores late project responses and stops polling after disposal', async () => {
	vi.useFakeTimers();
	let resolve!: (value: unknown) => void;
	const deploymentProgress = vi.fn(
		() =>
			new Promise((done) => {
				resolve = done;
			})
	);
	const state = { projectId: 'one', bridge: { deploymentProgress } };
	const workspace = state as unknown as Workspace;
	const update = vi.fn();
	const stop = deploymentUpdates(workspace, 'plan', update);
	try {
		await vi.advanceTimersByTimeAsync(200);
		state.projectId = 'two';
		resolve({ phase: 'uploading', detail: 'Old project' });
		await vi.advanceTimersByTimeAsync(200);
		expect(update).not.toHaveBeenCalled();
		stop();
		await vi.advanceTimersByTimeAsync(1000);
		expect(deploymentProgress).toHaveBeenCalledOnce();
	} finally {
		stop();
		vi.useRealTimers();
	}
});
