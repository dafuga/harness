import { productionPromotion } from './productionPromotion';
import { createHash } from 'node:crypto';
import { deploymentEnvironments } from '../models/Deployment.types';
import type {
	DeploymentPlan,
	DeploymentPlugin,
	CloudflareTarget,
	DeploymentConfig,
	DeploymentEnvironment
} from '../models/Deployment.types';
import { gitRead } from './gitRead';
import { deploymentState } from './deploymentState';
export function deploymentProof(config: DeploymentConfig): string {
	return createHash('sha256').update(JSON.stringify(config)).digest('hex');
}
export async function deploymentBlockers(
	root: string,
	query: { commit: string; environment: DeploymentEnvironment },
	config: DeploymentConfig
) {
	if (query.environment === 'prod')
		return productionPromotion(root, config, deploymentProof(config));
	const blockers: string[] = [];
	const branch = (
		await gitRead(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(() => '')
	).trim();
	const commit = (await gitRead(root, ['rev-parse', 'HEAD'])).trim();
	if (branch !== config.sourceBranch || commit !== query.commit)
		blockers.push('The source branch or commit changed; select its current tip.');
	if ((await gitRead(root, ['status', '--porcelain'])).trim())
		blockers.push('Commit source changes before deployment.');
	if (!config.targets[query.environment])
		blockers.push(
			`Configure the ${query.environment} target and its dedicated credential/health URL in harness.deploy.json.`
		);
	const configured = deploymentEnvironments.filter((item) => config.targets[item]);
	const index = configured.indexOf(query.environment);
	const previous = configured[index - 1];
	if (
		previous &&
		!(await deploymentState(root)).some(
			(item) =>
				item.environment === previous &&
				item.commit === commit &&
				item.configuration === deploymentProof(config)
		)
	)
		blockers.push(`Deploy this exact source commit to ${previous} first.`);
	if (query.environment !== 'dev' && !previous)
		blockers.push('Configure a preceding lower environment before promotion.');
	return { blockers, branch, promotion: undefined };
}
export async function deploymentHealth(target: CloudflareTarget): Promise<boolean> {
	try {
		return (
			await fetch(target.healthUrl, { redirect: 'error', signal: AbortSignal.timeout(20000) })
		).ok;
	} catch {
		return false;
	}
}

export async function deploymentCurrent(
	root: string,
	plan: DeploymentPlan,
	guard: { plugin: DeploymentPlugin; fingerprint: string; phase?: string }
) {
	const config = await guard.plugin.discover(root);
	if (!config.sourceBranch) config.sourceBranch = plan.branch;
	if (deploymentProof(config) !== guard.fingerprint)
		throw new Error(`Deployment configuration changed${guard.phase ?? ''}; review again.`);
	const proof = await deploymentBlockers(root, plan, config);
	if (
		plan.environment === 'prod' &&
		JSON.stringify(proof.promotion) !== JSON.stringify(plan.promotion)
	)
		throw new Error('Preprod or production changed; review the promotion again.');
	if (proof.blockers.length) {
		if (guard.phase)
			throw new Error(
				'Source or promotion state changed during deployment; inspect Cloudflare before retrying.'
			);
		throw new Error(proof.blockers.join(' '));
	}
	return config;
}
