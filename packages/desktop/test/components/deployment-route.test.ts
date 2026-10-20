import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import DeploymentRoute from '../../src/components/DeploymentRoute.svelte';
import { deploymentActivityFixture } from '../deployment-ui-fixture';

test('routes announce the captured environment or Git branch as the source', () => {
	for (const [sourceEnvironment, environment, source] of [
		['dev', 'preprod', 'dev'],
		[null, 'dev', 'feat/change']
	] as const) {
		const deployment = deploymentActivityFixture({
			sourceEnvironment,
			environment,
			branch: source
		});
		const { body } = render(DeploymentRoute, { props: { deployment } });
		expect(body).toContain(`aria-label="From ${source} to ${environment}"`);
		expect(body).toMatch(/<span[^>]*aria-hidden="true"[^>]*>→<\/span>/);
	}
});
