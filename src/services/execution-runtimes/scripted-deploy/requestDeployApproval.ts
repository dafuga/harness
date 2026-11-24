// @harness-uid u_2gix6yvno4
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { hash } from '../../../core/execution-runtimes/scripted-deploy/contracts';
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
import type { ApprovalContext } from './requestDeployApproval.types';

export async function requestDeployApproval(
	context: ApprovalContext,
	registry: DeployRegistry,
	config: DeployProject
): Promise<ApprovalReceipt | undefined> {
	const inbox = registry.approvalInbox;
	if (!inbox || context.plan.environment === 'staging') return undefined;
	return new DeployApprovalClient(inbox).wait(deployApprovalCard(context, config.scripts.smoke));
}

function deployApprovalCard({ plan, chain, differences }: ApprovalContext, script: string) {
	const candidate = plan.restore ?? plan.release;
	if (!candidate?.artifact)
		throw new ExpectedCliError('Exact deploy approval requires a pinned artifact.');
	const { target, version, source, artifact } = plan.restore ?? plan.previous;
	return approvalCard.parse({
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
		smoke: script,
		manifest: plan.manifest,
		predecessor:
			chain?.smoke && plan.signoff
				? { id: chain.plan.id, signoff: plan.signoff, smoke: chain.smoke.checks }
				: null,
		rollback: { target, version, source, artifact },
		expiresAt: plan.createdAt + approvalWindowMs
	});
}
