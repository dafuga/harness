import { ExpectedCliError } from '../../../core/development-tooling/errors';
import {
	hash,
	type Journal,
	type Plan
} from '../../../core/execution-runtimes/scripted-deploy/contracts';
import {
	approvalCard,
	approvalWindowMs
} from '../../../core/execution-runtimes/scripted-deploy/approvalInbox';
import type { ApprovalReceipt } from '../../../core/execution-runtimes/scripted-deploy/approvalInbox.types';
import type {
	DeployProject,
	DeployRegistry
} from '../../../validators/execution-runtimes/DeployManifestValidator';
import { DeployApprovalClient } from './DeployApprovalClient';

export async function requestDeployApproval(
	{ plan, chain, differences }: { plan: Plan; chain: Journal | null; differences: number },
	registry: DeployRegistry,
	config: DeployProject
): Promise<ApprovalReceipt | undefined> {
	if (!registry.approvalInbox || plan.environment === 'staging') return;
	const candidate = plan.restore ?? plan.release;
	if (!candidate?.artifact)
		throw new ExpectedCliError('Exact deploy approval requires a pinned artifact.');
	const { target, version, source, artifact } = plan.restore ?? plan.previous;
	const card = approvalCard.parse({
		id: plan.id,
		plan: hash(plan),
		project: plan.project,
		environment: plan.environment,
		action: plan.action,
		target: plan.target,
		source: candidate.source,
		artifact: candidate.artifact,
		release: plan.release?.id ?? null,
		parity: plan.parity,
		allowedDifferences: differences,
		smoke: config.scripts.smoke,
		manifest: plan.manifest,
		predecessor:
			chain?.smoke && plan.signoff
				? { id: chain.plan.id, signoff: plan.signoff, smoke: chain.smoke.checks }
				: null,
		rollback: { target, version, source, artifact },
		expiresAt: plan.createdAt + approvalWindowMs
	});
	return new DeployApprovalClient(registry.approvalInbox).wait(card);
}
