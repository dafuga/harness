import { expect, test, vi } from 'vitest';
import { createDeploymentActivityStore } from '../../src/lib/stores/deploymentActivity.svelte';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
import { deploymentActivityFixture } from '../deployment-ui-fixture';

test('late reads cannot erase new jobs and read failures retain last-known status', async () => {
	vi.useFakeTimers();
	let resolve!: (value: never[]) => void;
	const read = vi
		.fn()
		.mockImplementationOnce(
			() =>
				new Promise<never[]>((done) => {
					resolve = done;
				})
		)
		.mockRejectedValue(new Error('offline'));
	const refresh = vi.fn();
	const workspace = {
		local: true,
		projectId: 'project',
		bridge: { deploymentActivities: read },
		deployments: { refresh }
	} as unknown as Workspace;
	const store = createDeploymentActivityStore(workspace),
		stop = store.watch();
	try {
		store.remember(deploymentActivityFixture());
		resolve([]);
		await vi.advanceTimersByTimeAsync(0);
		expect(store.activeCount).toBe(1);
		await vi.advanceTimersByTimeAsync(500);
		expect(store.error).toContain('last known deployments');
		expect(store.items).toHaveLength(1);
	} finally {
		stop();
		vi.useRealTimers();
	}
});
