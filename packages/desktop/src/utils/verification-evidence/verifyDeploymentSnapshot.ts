// @harness-uid u_rypbc675b6
import type {
	DeploymentPlugin,
	DeploymentReceipt
} from '../../models/development-tooling/Deployment.types';
import { deploymentEnvironments } from '../../models/development-tooling/Deployment.types';
import type { ReviewedDeployment } from '../../services/development-tooling/DeploymentService';
import { DeploymentSnapshotVerificationError } from './verifyDeploymentSnapshot.types';
import { deploymentProof } from '../projects-sessions/deploymentProof';
import { deploymentState } from '../projects-sessions/deploymentState';
import { gitRead, gitRevision } from '../projects-sessions/gitRead';
import type { CloudflareTarget } from '../../models/development-tooling/Deployment.types';

async function configuration(root: string, reviewed: ReviewedDeployment, plugin: DeploymentPlugin) {
	const config = await plugin.discover(root);
	if (!config.sourceBranch) config.sourceBranch = reviewed.plan.branch;
	if (deploymentProof(config) !== reviewed.fingerprint)
		throw new DeploymentSnapshotVerificationError(
			'Deployment configuration changed; review again.'
		);
	return config;
}
/** Captured lower receipts stay valid as a newer pipeline advances in another environment. */
export async function captureDeploymentTarget(
	reviewed: ReviewedDeployment,
	plugin: DeploymentPlugin
): Promise<{ target: CloudflareTarget; destination: DeploymentReceipt | null }> {
	const config = await configuration(reviewed.root, reviewed, plugin);
	const environments = deploymentEnvironments.filter((item) => config.targets[item]);
	const previous = environments[environments.indexOf(reviewed.plan.environment) - 1];
	const proof = reviewed.predecessor;
	if (
		previous &&
		(proof?.environment !== previous ||
			proof.commit !== reviewed.plan.commit ||
			proof.configuration !== reviewed.fingerprint)
	)
		throw new DeploymentSnapshotVerificationError(
			`A verified ${previous} deployment of this exact source and configuration is required.`
		);
	const destination =
		(await deploymentState(reviewed.root)).find(
			(item) => item.environment === reviewed.plan.environment
		) ?? null;
	if (destination) {
		try {
			await gitRead(reviewed.root, [
				'merge-base',
				'--is-ancestor',
				destination.commit,
				reviewed.plan.commit
			]);
		} catch {
			throw new DeploymentSnapshotVerificationError(
				'A deployment cannot move its destination backwards or across divergent history.'
			);
		}
	}
	return { target: config.targets[reviewed.plan.environment]!, destination };
}

export async function verifyDeploymentSnapshot(
	root: string,
	reviewed: ReviewedDeployment,
	guard: { plugin: DeploymentPlugin; destination: DeploymentReceipt | null }
) {
	if (root !== reviewed.root) {
		if (
			(await gitRevision(root)) !== reviewed.plan.commit ||
			(await gitRead(root, ['status', '--porcelain'])).trim()
		)
			throw new DeploymentSnapshotVerificationError(
				'The isolated deployment source changed during the build.'
			);
	}
	await configuration(root, reviewed, guard.plugin);
	const destination =
		(await deploymentState(reviewed.root)).find(
			(item) => item.environment === reviewed.plan.environment
		) ?? null;
	if (JSON.stringify(destination) !== JSON.stringify(guard.destination))
		throw new DeploymentSnapshotVerificationError(
			'The deployment destination changed during deployment; inspect Cloudflare before retrying.'
		);
}
