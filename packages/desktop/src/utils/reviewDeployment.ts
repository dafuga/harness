import { randomUUID } from 'node:crypto';
import { deploymentEnvironments, deploymentSteps } from '../models/Deployment.types';
import type {
	CloudflareTarget,
	DeploymentConfig,
	DeploymentEnvironment,
	DeploymentPlugin,
	DeploymentQuery
} from '../models/Deployment.types';
import type { ReviewedDeployment } from '../services/DeploymentService';
import { deploymentBlockers, deploymentProof } from './deploymentProof';
import { deploymentState } from './deploymentState';

/** Read-only admission; a chat chain checks the source once and supplies later predecessor proofs. */
export async function reviewDeployment(
	root: string,
	input: DeploymentQuery,
	options: { plugin: DeploymentPlugin; projectId: string | null; queuedChange?: boolean }
): Promise<ReviewedDeployment> {
	const config = await options.plugin.discover(root);
	const query = options.queuedChange ? { ...input, environment: 'dev' as const } : input;
	const proof = await deploymentBlockers(root, query, config);
	const target = config.targets[input.environment];
	const blockers = [...proof.blockers];
	if (!target) blockers.push(`Configure the ${input.environment} deployment target.`);
	const previous = predecessorEnvironment(config, input.environment);
	const predecessor =
		proof.promotion?.preprod ??
		(await deploymentState(root)).find((receipt) => receipt.environment === previous) ??
		null;
	const plan = {
		id: randomUUID(),
		environment: input.environment,
		commit: proof.promotion?.preprod?.commit ?? input.commit,
		...(proof.promotion ? { promotion: proof.promotion } : {}),
		branch: proof.branch,
		adapter: options.plugin.id,
		target: describeTarget(target),
		steps: deploymentSteps.map((step) => step.title),
		blockers,
		expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
	};
	return {
		plan,
		sourceEnvironment: previous,
		root,
		projectId: options.projectId,
		fingerprint: deploymentProof(config),
		target,
		predecessor
	};
}
function describeTarget(target?: CloudflareTarget) {
	return target
		? `${target.kind} · ${target.name} · ${target.wranglerEnvironment || target.branch} · account ${target.accountId} · ${target.healthUrl}`
		: 'Unconfigured';
}

function predecessorEnvironment(config: DeploymentConfig, environment: DeploymentEnvironment) {
	const configured = deploymentEnvironments.filter((item) => config.targets[item]);
	return configured[configured.indexOf(environment) - 1] ?? null;
}
