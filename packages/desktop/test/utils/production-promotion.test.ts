import { expect, test } from 'vitest';
import { deploymentFixture } from '../deployment-fixture';
import { productionPromotion } from '../../src/utils/productionPromotion';
import { deploymentProof } from '../../src/utils/deploymentProof';
import { saveDeployment } from '../../src/utils/deploymentState';

test('production comparison counts a forward Git range, including initial deployment', async () => {
	const f = await deploymentFixture();
	const configuration = deploymentProof(f.config);
	await saveDeployment(f.root, {
		environment: 'preprod',
		commit: f.commit,
		branch: 'dev',
		configuration,
		adapter: 'cloudflare',
		deploymentId: 'preprod',
		url: 'https://example.invalid',
		updatedAt: new Date().toISOString()
	});
	const initial = await productionPromotion(f.root, f.config, configuration);
	expect(initial).toMatchObject({
		blockers: [],
		promotion: { commitsBehind: 1, production: null }
	});
	f.git('checkout', '-b', 'other');
	f.git('commit', '--allow-empty', '-m', 'feat: divergent production');
	const divergent = f.git('rev-parse', 'HEAD');
	f.git('checkout', 'dev');
	f.git('commit', '--allow-empty', '-m', 'feat: divergent preprod');
	await saveDeployment(f.root, {
		...initial.promotion.preprod!,
		environment: 'prod',
		commit: divergent
	});
	const comparison = await productionPromotion(f.root, f.config, configuration);
	expect(comparison.promotion.commitsBehind).toBeNull();
	expect(comparison.blockers.join(' ')).toMatch(/forward-only/);
});

test('missing preprod, unavailable commit history and stale configuration cannot promote', async () => {
	const f = await deploymentFixture();
	expect((await productionPromotion(f.root, f.config, 'current')).blockers.join(' ')).toMatch(
		/preprod/
	);
	await saveDeployment(f.root, {
		environment: 'preprod',
		commit: 'a'.repeat(40),
		branch: 'dev',
		configuration: 'old',
		adapter: 'cloudflare',
		deploymentId: 'preprod',
		url: 'https://example.invalid',
		updatedAt: new Date().toISOString()
	});
	const plan = await productionPromotion(f.root, f.config, 'current');
	expect(plan.blockers.join(' ')).toMatch(/configuration/);
	expect(plan.blockers.join(' ')).toMatch(/history/);
});
