import { expect, test, vi } from 'vitest';
import { deploymentFixture } from '../deployment-fixture';
import { saveDeployment } from '../../src/utils/deploymentState';
test('an external destination change during upload cannot be overwritten with a verified receipt', async () => {
	const f = await deploymentFixture();
	const dev = await f.service.automatic({ environment: 'dev', commit: f.commit });
	vi.mocked(f.plugin.deploy).mockImplementationOnce(async () => {
		await saveDeployment(f.root, { ...dev, environment: 'stage', deploymentId: 'external-stage' });
		return { deploymentId: 'own-upload', url: 'https://example.invalid' };
	});
	const plan = await f.service.plan({ environment: 'stage', commit: f.commit });
	await expect(f.service.deploy({ planId: plan.id })).rejects.toThrow(/destination changed/);
	expect(
		(await f.service.status()).find((item) => item.environment === 'stage')?.receipt?.deploymentId
	).toBe('external-stage');
	expect((await f.service.progress({ planId: plan.id }))?.step).toBe('verifying');
});
