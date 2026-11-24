// @harness-uid u_2gix6yvno4
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
import type {
	ApprovalReceipt,
	DeployProgress
} from '../../../core/execution-runtimes/scripted-deploy/approvalInbox.types';
import type {
	DeployProject,
	DeployRegistry
} from '../../../validators/execution-runtimes/DeployManifestValidator';
import { DeployApprovalClient } from './DeployApprovalClient';
import type { ApprovalContext } from './requestDeployApproval.types';
import type { DeployPlanning } from './DeployPlanning';

export async function requestDeployApproval(
	context: ApprovalContext,
	registry: DeployRegistry,
	config: DeployProject
): Promise<ApprovalReceipt | undefined> {
	const inbox = registry.approvalInbox;
	if (context.controlled)
		return runControlClient(registry).wait(deployApprovalCard(context, config.scripts.smoke));
	if (!inbox || context.plan.environment === 'staging') return undefined;
	return new DeployApprovalClient(inbox).wait(deployApprovalCard(context, config.scripts.smoke));
}

export function runControlClient(registry: DeployRegistry): DeployApprovalClient {
	if (!registry.approvalInbox)
		throw new ExpectedCliError('This runner is not enrolled in the deploy inbox.');
	return new DeployApprovalClient(registry.approvalInbox);
}

export function deployApprovalCard(
	{ plan, chain, differences, controlled, rollbackFrom }: ApprovalContext,
	script: string
) {
	const candidate = plan.restore ?? plan.release;
	const legacyRestore = controlled && plan.environment === 'staging' && plan.action === 'rollback';
	if (!candidate || (!candidate.artifact && !legacyRestore))
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
		...(controlled ? { control: { run: plan.id, rollbackFrom } } : {}),
		expiresAt: plan.createdAt + approvalWindowMs
	});
}

export function controlScope(plan: Plan) {
	return { id: plan.id, plan: hash(plan), project: plan.project, environment: plan.environment };
}

export async function publishReadOnlyPlan(
	registry: DeployRegistry,
	result: Awaited<ReturnType<DeployPlanning['plan']>>,
	input: { smoke: string; rollbackFrom?: string }
): Promise<void> {
	const { plan, predecessor, parity } = result;
	const card = deployApprovalCard(
		{
			plan,
			chain: predecessor,
			differences: parity.differences.filter((difference) => difference.reason).length,
			controlled: true,
			rollbackFrom: input.rollbackFrom
		},
		input.smoke
	);
	await runControlClient(registry).publish(
		approvalCard.parse({
			...card,
			control: {
				...card.control!,
				preview: {
					blocked: parity.blocked,
					fields: parity.differences
						.filter((difference) => !difference.reason)
						.slice(0, 250)
						.map(({ environment, field }) => `${environment}:${field}`)
				}
			}
		})
	);
}

export async function publishRunProgress(registry: DeployRegistry, record: Journal): Promise<void> {
	if (!record.controlled || !registry.approvalInbox) return;
	const progress = providerProgress(record);
	await reportControlledRun(
		new DeployApprovalClient(registry.approvalInbox),
		controlScope(record.plan),
		progress
	);
}

export async function reportControlledRun(
	client: DeployApprovalClient,
	scope: ReturnType<typeof controlScope>,
	progress: DeployProgress
): Promise<void> {
	try {
		await client.report(scope, progress);
	} catch {
		// The local journal is authoritative. A status transport outage must never resubmit a write.
	}
}

function providerProgress({ phase, result, smoke }: Journal): DeployProgress {
	if (phase === 'pending') return { phase: 'stopped' };
	if (phase === 'applying' || phase === 'not-applied') return { phase };
	const receipt = { operation: result!.operation, version: result!.observed.version };
	return phase === 'deployed'
		? { phase, ...receipt }
		: { phase, ...receipt, checks: smoke!.checks };
}
