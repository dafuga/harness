import { expect, test, vi } from 'vitest';
import { createDeploymentsStore } from '../../src/lib/stores/deployments.svelte';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
test('environment selection never deploys; only the reviewed plan can be confirmed once', async () => {
	const plan = { id: 'one', environment: 'preprod', commit: 'a', blockers: [] };
	const deploy = vi.fn(async () => ({ environment: 'preprod', commit: 'a' }));
	const planDeployment = vi.fn(async () => plan);
	const workspace = {
		local: true,
		capabilities: { agents: true },
		snapshot: { revision: { commit: 'a' } },
		projectId: 'p',
		context: { projectId: 'p' },
		bridge: { deploy, planDeployment }
	} as unknown as Workspace;
	const store = createDeploymentsStore(workspace);
	store.choose('preprod');
	expect(deploy).not.toHaveBeenCalled();
	await store.review();
	expect(deploy).not.toHaveBeenCalled();
	await store.execute();
	await store.execute();
	expect(deploy).toHaveBeenCalledOnce();
	expect(deploy).toHaveBeenCalledWith({ projectId: 'p', planId: 'one' });
});
