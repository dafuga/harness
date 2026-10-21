import { expect, test, vi } from 'vitest';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
import { watchDeploymentActivities } from '../../src/utils/watchDeploymentActivities';
test('host activity survives project navigation but ignores old connectors and disposed reads', async () => {
	vi.useFakeTimers();
	let resolve!: (value: never[]) => void;
	const state = {
		local: true,
		projectId: 'one',
		bridge: {
			deploymentActivities: vi.fn(
				() =>
					new Promise<never[]>((done) => {
						resolve = done;
					})
			)
		}
	};
	const received = vi.fn(),
		failed = vi.fn();
	const stop = watchDeploymentActivities(state as unknown as Workspace, {
		version: () => 0,
		received,
		failed
	});
	try {
		state.projectId = 'two';
		resolve([]);
		await vi.advanceTimersByTimeAsync(0);
		expect(received).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(500);
		state.bridge = { deploymentActivities: vi.fn(async () => []) };
		resolve([]);
		await vi.advanceTimersByTimeAsync(0);
		expect(received).toHaveBeenCalledOnce();
		stop();
		await vi.advanceTimersByTimeAsync(1000);
		expect(state.bridge.deploymentActivities).not.toHaveBeenCalled();
	} finally {
		stop();
		vi.useRealTimers();
	}
});
