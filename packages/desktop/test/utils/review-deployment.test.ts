import { expect, test } from 'vitest';
import { deploymentFixture } from '../deployment-fixture';
test('a returned plan cannot replace the host-owned source or destination', async () => {
	const f = await deploymentFixture();
	const plan = await f.service.plan({ environment: 'dev', commit: f.commit });
	plan.environment = 'prod';
	plan.commit = 'b'.repeat(40);
	await expect(f.service.deploy({ planId: plan.id })).resolves.toMatchObject({
		environment: 'dev',
		commit: f.commit
	});
	expect(f.git('status', '--porcelain')).toBe('');
});
