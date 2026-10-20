import { expect, test, vi } from 'vitest';
import { createDeploymentsStore } from '../../src/lib/stores/deployments.svelte';
import { createDeploymentActivityStore } from '../../src/lib/stores/deploymentActivity.svelte';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
import { deploymentActivityFixture } from '../deployment-ui-fixture';
test('one reviewed production action starts one background job and shares its progress', async () => {
	const plan = { id: 'one', environment: 'prod', commit: 'preprod', blockers: [] };
	const job = deploymentActivityFixture({ id: 'one' });
	const startDeployment = vi.fn(async () => job),
		planDeployment = vi.fn(async () => plan);
	const workspace = {
		local: true,
		capabilities: { agents: true },
		snapshot: { revision: { commit: 'newer-local' } },
		projectId: 'p',
		context: { projectId: 'p' },
		bridge: { startDeployment, planDeployment, deploymentActivities: async () => [] }
	} as unknown as Workspace;
	const activity = createDeploymentActivityStore(workspace);
	Object.assign(workspace, { activity });
	const store = createDeploymentsStore(workspace);
	store.choose('preprod');
	await store.review();
	expect(startDeployment).not.toHaveBeenCalled();
	expect(planDeployment).toHaveBeenCalledWith({
		projectId: 'p',
		environment: 'prod',
		commit: 'newer-local'
	});
	await store.execute();
	await store.execute();
	expect(startDeployment).toHaveBeenCalledOnce();
	expect(store.pending).toBe(true);
	expect(store.job?.id).toBe('one');
	activity.remember({
		...job,
		phase: 'failed',
		error: 'Health failed',
		finishedAt: new Date().toISOString()
	});
	expect(store.pending).toBe(false);
	expect(store.job?.error).toBe('Health failed');
});
