import { expect, test, vi } from 'vitest';
import { deploymentFixture } from '../deployment-fixture';
import { saveDeployment } from '../../src/utils/deploymentState';

test('stale confirmation is refused, but captured lower receipts can advance during upload', async () => {
	const f = await deploymentFixture();
	for (const environment of ['dev', 'stage', 'preprod'] as const)
		await f.service.automatic({ environment, commit: f.commit });
	const review = () => f.service.plan({ environment: 'prod', commit: f.commit });
	const preprod = (await f.service.status()).find(
		(item) => item.environment === 'preprod'
	)!.receipt!;
	const plan = await review();
	await saveDeployment(f.root, { ...preprod, deploymentId: 'redeployed-preprod' });
	const before = vi.mocked(f.plugin.deploy);
	const calls = before.mock.calls.length;
	await expect(f.service.deploy({ planId: plan.id })).rejects.toThrow(/changed/);
	expect(before).toHaveBeenCalledTimes(calls);
	const next = await review();
	before.mockImplementationOnce(async () => {
		await saveDeployment(f.root, { ...preprod, deploymentId: 'concurrent-preprod' });
		return { deploymentId: 'uploaded', url: 'https://example.invalid' };
	});
	await expect(f.service.deploy({ planId: next.id })).resolves.toMatchObject({ commit: f.commit });
	expect(
		(await f.service.status()).find((item) => item.environment === 'prod')?.receipt?.commit
	).toBe(f.commit);
	expect((await f.service.progress({ planId: next.id }))?.phase).toBe('complete');
});

test('build-time source mutation cannot upload a different production artifact', async () => {
	const { writeFile } = await import('node:fs/promises');
	const { join } = await import('node:path');
	const f = await deploymentFixture();
	await writeFile(join(f.root, 'source.txt'), 'verified preprod source');
	f.git('add', '.');
	f.git('commit', '-m', 'feat: source fixture');
	const commit = f.git('rev-parse', 'HEAD');
	for (const environment of ['dev', 'stage', 'preprod'] as const)
		await f.service.automatic({ environment, commit });
	const calls = vi.mocked(f.plugin.deploy).mock.calls.length;
	f.execute.mockImplementation(async (command) => {
		if (command.args[2] === 'build')
			await writeFile(join(command.cwd, 'source.txt'), 'unexpected mutation');
		return 'passed';
	});
	const plan = await f.service.plan({ environment: 'prod', commit });
	await expect(f.service.deploy({ planId: plan.id })).rejects.toThrow(
		/isolated deployment source changed/
	);
	expect(f.plugin.deploy).toHaveBeenCalledTimes(calls);
	expect(
		(await f.service.status()).find((item) => item.environment === 'prod')?.receipt
	).toBeNull();
	expect(f.git('status', '--porcelain')).toBe('');
});
