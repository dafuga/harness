import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import DeploymentProgress from '../../src/components/DeploymentProgress.svelte';
import { deploymentActivityFixture } from '../deployment-ui-fixture';
test('shared progress names its current step and retains failure position', () => {
	const deployment = deploymentActivityFixture({
		phase: 'failed',
		step: 'uploading',
		detail: 'Deployment failed'
	});
	const { body } = render(DeploymentProgress, { props: { deployment } });
	expect(body).toContain('aria-label="Deployment steps"');
	expect(body).toMatch(/aria-current="step"[^>]*>[\s\S]*?Deploy to Cloudflare/);
	expect(body).toContain('role="status"');
	expect(body).toContain('Deployment failed');
});
