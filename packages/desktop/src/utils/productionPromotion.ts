import type { DeploymentConfig, DeploymentReceipt } from '../models/Deployment.types';
import { deploymentState } from './deploymentState';
import { gitRead, gitRevision } from './gitRead';

/** Production follows verified preprod, never the currently inspected checkout. */
export async function productionPromotion(
	root: string,
	config: DeploymentConfig,
	fingerprint: string
) {
	const receipts = await deploymentState(root);
	const preprod = receipts.find((item) => item.environment === 'preprod') ?? null;
	const production = receipts.find((item) => item.environment === 'prod') ?? null;
	const blockers: string[] = [];
	if (!config.targets.prod || !config.targets.preprod)
		blockers.push('Configure both preprod and production deployment targets.');
	if (!preprod) blockers.push('Deploy a verified source commit to preprod first.');
	if (preprod && preprod.configuration !== fingerprint)
		blockers.push('Deploy the current configuration to preprod before promoting.');
	const commitsBehind = preprod ? await distance(root, preprod, production, blockers) : null;
	if (commitsBehind === 0) blockers.push('Production is already up to date with preprod.');
	return {
		blockers,
		branch: config.sourceBranch,
		promotion: { preprod, production, commitsBehind }
	};
}

async function distance(
	root: string,
	preprod: DeploymentReceipt,
	production: DeploymentReceipt | null,
	blockers: string[]
) {
	try {
		await gitRevision(root, preprod.commit);
		if (production) {
			await gitRevision(root, production.commit);
			await gitRead(root, ['merge-base', '--is-ancestor', production.commit, preprod.commit]);
		}
		const range = production ? `${production.commit}..${preprod.commit}` : preprod.commit;
		return Number((await gitRead(root, ['rev-list', '--count', range])).trim());
	} catch {
		blockers.push('Production and preprod must have available, forward-only commit history.');
		return null;
	}
}
