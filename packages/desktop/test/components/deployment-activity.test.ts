import { expect, test, vi } from 'vitest';
import { render } from 'svelte/server';
import DeploymentActivity from '../../src/components/DeploymentActivity.svelte';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
import { deploymentActivityFixture } from '../deployment-ui-fixture';
test('the activity trigger exposes work without relying only on colour', () => {
	const workspace = {
		local: true,
		bridge: { deploymentActivities: vi.fn() },
		activity: { items: [deploymentActivityFixture()], activeCount: 1, error: '', watch: vi.fn() }
	} as unknown as Workspace;
	const { body } = render(DeploymentActivity, { props: { workspace } });
	expect(body).toContain('aria-label="Deployments"');
	expect(body).toContain('data-active="1"');
});
