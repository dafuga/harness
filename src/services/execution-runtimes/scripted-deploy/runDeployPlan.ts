// @harness-uid u_3diuooz2wz
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type { ApprovalReceipt } from '../../../core/execution-runtimes/scripted-deploy/approvalInbox.types';
import {
	hash,
	type Journal,
	type Plan
} from '../../../core/execution-runtimes/scripted-deploy/contracts';
import { assertResult } from '../../../core/execution-runtimes/scripted-deploy/parity';
import { verifyApproval } from '../../../core/execution-runtimes/scripted-deploy/proofs';
import { verifyArtifact } from '../../../core/execution-runtimes/scripted-deploy/releaseFiles';
import { verifyCurrentDeployPlan, type DeployRequest } from './DeployPlanning';
import {
	controlScope,
	publishRunProgress,
	requestDeployApproval,
	runControlClient
} from './requestDeployApproval';
import type { DeployRunContext } from './runDeployPlan.types';

export async function runDeployPlan(
	context: DeployRunContext,
	input: DeployRequest,
	controlled: boolean
): Promise<Journal> {
	const { registry, store, config, planning } = context;
	const { plan, parity, predecessor } = await planning.plan(input);
	if (parity.blocked)
		throw new ExpectedCliError(
			'Deployment parity has unexpected differences. Run with --plan to view them.'
		);
	if (!plan.release && !plan.restore)
		throw new ExpectedCliError('Deployment requires a prepared release.');
	const artifact = await verifyPreparedArtifact(context, plan);
	const record: Journal = { plan, phase: 'pending', ...(controlled ? { controlled: true } : {}) };
	try {
		if (controlled || (registry.approvalInbox && plan.environment !== 'staging'))
			store.save(record);
		const decision = await requestDeployApproval(
			{
				plan,
				chain: predecessor,
				differences: parity.differences.length,
				controlled,
				rollbackFrom: input.rollback
			},
			registry,
			config
		);
		store.lock(plan.project, plan.environment, plan.id);
		return await apply(context, record, { input, artifact }, decision);
	} catch (error) {
		await publishRunProgress(registry, record);
		const reason = error instanceof Error ? error.message : 'Operation failed.';
		throw new ExpectedCliError(`Deployment run ${plan.id} stopped. ${reason}`);
	} finally {
		if (record.phase !== 'applying' && store.active(plan.project, plan.environment) === plan.id)
			store.unlock(record);
	}
}

async function apply(
	context: DeployRunContext,
	record: Journal,
	{ artifact, input }: { artifact: string | null; input: DeployRequest },
	decision?: ApprovalReceipt
): Promise<Journal> {
	const { registry, store, broker, planning, config, verification } = context;
	const { plan } = record;
	store.save(record);
	const approval = await broker.authorize(plan, decision);
	verifyApproval(plan, approval, registry, decision);
	await verifyCurrentDeployPlan(planning, config, plan, input);
	await broker.note(
		plan.item,
		`Deploy approval ${approval.payload.reference} for ${plan.action} run ${plan.id}, target ${plan.target}, plan ${hash(plan)}`
	);
	if (artifact) await verifyPreparedArtifact(context, plan);
	verifyApproval(plan, approval, registry, decision);
	if (record.controlled) {
		await runControlClient(registry).admit(controlScope(plan));
		verifyApproval(plan, approval, registry, decision);
	}
	record.approval = approval;
	record.phase = 'applying';
	store.save(record);
	const [result] = await Promise.all([
		broker.apply(plan, approval, artifact),
		publishRunProgress(registry, record)
	]);
	assertResult(plan, result.observed);
	record.result = result;
	record.phase = 'deployed';
	store.save(record);
	await publishRunProgress(registry, record);
	return verification.verify(record);
}

async function verifyPreparedArtifact(
	{ store, config }: DeployRunContext,
	plan: Plan
): Promise<string | null> {
	const value = plan.release;
	if (!value) return null;
	if (
		value.project !== plan.project ||
		value.manifest !== plan.manifest ||
		value.image !== config.image
	)
		throw new ExpectedCliError(
			'Prepared artifact belongs to another project, manifest, or toolchain.'
		);
	return verifyArtifact(store, value);
}
