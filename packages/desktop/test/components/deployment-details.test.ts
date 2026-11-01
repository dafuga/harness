import {
	deploymentFacts,
	receiptFacts
} from '../../src/components/development-tooling/deploymentFacts';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import DeploymentDetails from '../../src/components/development-tooling/DeploymentDetails.svelte';
import { deploymentActivityFixture } from '../deployment-ui-fixture';
test('activity and production details share progress, errors and receipt rendering', async () => {
	const deployment = deploymentActivityFixture({
		phase: 'failed',
		error: 'Health verification failed',
		finishedAt: '2026-10-20T10:16:00.000Z'
	});
	await measureWorkload(
		'desktop.function.development-tooling-deployment-facts',
		'deployment-identity-and-receipt',
		() => {
			expect(deploymentFacts(deployment).map((row) => row.name)).toEqual([
				'Project',
				'Branch',
				'Commit',
				'Started',
				'Finished'
			]);
			expect(deploymentFacts({ ...deployment, startedAt: null, finishedAt: null })[3].name).toBe(
				'Queued'
			);
			const receipt = {
				environment: 'prod' as const,
				commit: 'a12bc34def',
				branch: 'main',
				updatedAt: '2026-11-01T09:00:00Z',
				adapter: 'cloudflare',
				deploymentId: 'orders-release',
				url: 'https://orders.example.com'
			};
			expect(receiptFacts(receipt).map((row) => row.value)).toEqual([
				'orders-release',
				'https://orders.example.com',
				'2026-11-01T09:00:00Z'
			]);
		}
	);
	for (const showIdentity of [true, false]) {
		const { body } = render(DeploymentDetails, { props: { deployment, showIdentity } });
		expect(body).toContain('aria-label="From preprod to prod"');
		expect(body).toContain('aria-label="Deployment steps"');
		expect(body).toContain('Health verification failed');
		expect(body).toContain('role="alert"');
	}
});
