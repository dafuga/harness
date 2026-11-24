// @harness-uid u_q4jcoafzvg
import { randomUUID } from 'node:crypto';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import {
	approvalCard,
	approvalWindowMs
} from '../../../core/execution-runtimes/scripted-deploy/approvalInbox';
import {
	hash,
	type Journal,
	type Proof
} from '../../../core/execution-runtimes/scripted-deploy/contracts';
import {
	assertObservation,
	sameVersion
} from '../../../core/execution-runtimes/scripted-deploy/parity';
import {
	signoffScope,
	verifySignoff
} from '../../../core/execution-runtimes/scripted-deploy/proofs';
import {
	manifestDigest,
	type DeployRegistry
} from '../../../validators/execution-runtimes/DeployManifestValidator';
import { deployApprovalCard, reportControlledRun, runControlClient } from './requestDeployApproval';
import type { DeploySignoffContext } from './recordDeploySignoff.types';

export async function recordDeploySignoff(
	context: DeploySignoffContext,
	id: string,
	proof: Proof,
	controlled: boolean
): Promise<Journal> {
	const { store, project, registry } = context;
	const record = store.get(id);
	if (record.plan.project !== project)
		throw new ExpectedCliError('Run belongs to another project.');
	const { environment } = record.plan;
	if (record.controlled && !controlled)
		throw new ExpectedCliError('This deployment requires sign-off with --wait-for-go.');
	verifyUnrecordedSignoff(record, proof, registry);
	const scope = controlled ? await waitForSignoff(context, record, proof) : undefined;
	try {
		store.lock(project, environment, id);
		try {
			const current = store.get(id);
			verifyUnrecordedSignoff(current, proof, registry);
			if (scope) await admitSignoff(context, current, proof, scope);
			await context.broker.note(
				record.plan.item,
				`Deploy sign-off ${proof.payload.reference} for run ${id}`
			);
			const signed = {
				...current,
				signoff: proof,
				...(scope ? { signoffControl: { id: scope.id, plan: scope.plan } } : {})
			};
			store.save(signed);
			await publishSignoff(registry, signed);
			return signed;
		} finally {
			store.unlock(record);
		}
	} catch (error) {
		if (scope) await reportControlledRun(runControlClient(registry), scope, { phase: 'stopped' });
		throw error;
	}
}

async function waitForSignoff(
	{ config, registry }: DeploySignoffContext,
	record: Journal,
	proof: Proof
) {
	const { plan } = record;
	const expiresAt = Math.min(Date.now() + approvalWindowMs, proof.payload.expiresAt);
	const card = approvalCard.parse({
		...deployApprovalCard({ plan, chain: null, differences: 0 }, config.scripts.smoke),
		id: randomUUID(),
		action: 'signoff',
		plan: hash({ run: plan.id, review: signoffScope(record), proof: hash(proof) }),
		control: {
			run: plan.id,
			review: { reference: proof.payload.reference, checks: record.smoke!.checks }
		},
		expiresAt
	});
	const { id, project, environment } = card;
	const scope = { id, project, environment, plan: card.plan };
	const client = runControlClient(registry);
	try {
		await client.wait(card);
	} catch (error) {
		await reportControlledRun(client, scope, { phase: 'stopped' });
		throw error;
	}
	return scope;
}

async function admitSignoff(
	{ broker, config, registry }: DeploySignoffContext,
	record: Journal,
	proof: Proof,
	scope: Awaited<ReturnType<typeof waitForSignoff>>
) {
	const { plan, result } = record;
	const observed = await broker.inspect(plan.project, plan.environment, plan.manifest);
	assertObservation(plan.target, observed);
	if (
		!result ||
		!sameVersion(result.observed, observed) ||
		plan.manifest !== manifestDigest(config)
	)
		throw new ExpectedCliError(
			'The reviewed release is no longer routed or its deploy manifest changed.'
		);
	verifyUnrecordedSignoff(record, proof, registry);
	await runControlClient(registry).admit(scope);
	verifyUnrecordedSignoff(record, proof, registry);
}

function verifyUnrecordedSignoff(record: Journal, proof: Proof, registry: DeployRegistry) {
	if (record.signoff) throw new ExpectedCliError('A sign-off is already recorded for this run.');
	verifySignoff(record, proof, registry);
}

export async function publishSignoff(
	registry: DeployRegistry,
	{ plan, signoff, signoffControl }: Journal
) {
	if (!signoff || !signoffControl || !registry.approvalInbox) return;
	await reportControlledRun(
		runControlClient(registry),
		{ ...signoffControl, project: plan.project, environment: plan.environment },
		{
			phase: 'signed-off',
			reference: signoff.payload.reference
		}
	);
}
