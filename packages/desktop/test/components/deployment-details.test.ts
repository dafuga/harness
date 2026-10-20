import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import DeploymentDetails from '../../src/components/DeploymentDetails.svelte';
import { deploymentActivityFixture } from '../deployment-ui-fixture';
test('activity and production details share progress, errors and receipt rendering', () => {
	const deployment = deploymentActivityFixture({
		phase: 'failed',
		error: 'Health verification failed',
		finishedAt: '2026-10-20T10:16:00.000Z'
	});
	for (const showIdentity of [true, false]) {
		const { body } = render(DeploymentDetails, { props: { deployment, showIdentity } });
		expect(body).toContain('aria-label="From preprod to prod"');
		expect(body).toContain('aria-label="Deployment steps"');
		expect(body).toContain('Health verification failed');
		expect(body).toContain('role="alert"');
	}
});
