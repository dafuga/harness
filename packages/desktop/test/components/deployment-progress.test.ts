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

test.each(['queued', 'checking', 'failed', 'complete'] as const)(
	'progress keeps the %s state explicit',
	(phase) => {
		const deployment = deploymentActivityFixture({ phase, detail: `${phase} deployment` });
		const { body } = render(DeploymentProgress, { props: { deployment } });
		expect(body).toContain(`${phase} deployment`);
		expect(body).toContain('aria-label="Deployment steps"');
		expect(body.match(/role="status"/g)).toHaveLength(1);
		if (phase === 'queued' || phase === 'complete')
			expect(body).not.toContain('aria-current="step"');
		else expect(body).toContain('aria-current="step"');
		if (phase === 'queued') expect(body).toContain('not started');
		if (phase === 'failed') expect(body).toContain('failed');
		if (phase === 'complete') expect(body).not.toContain('not started');
	}
);
