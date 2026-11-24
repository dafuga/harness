// @harness-uid u_bycapn5sbw
import { ExpectedCliError } from '../../development-tooling/errors';
import type { Issuer } from './proofs.types';
import { approvalClockSkewMs, approvalWindowMs } from './approvalInbox';
import type { ApprovalReceipt } from './approvalInbox.types';
import { createPublicKey, verify } from 'node:crypto';
import { hash, canonical, type Journal, type Plan, type Proof } from './contracts';
import type { DeployRegistry } from '../../../validators/execution-runtimes/DeployManifestValidator';

export function verifyProof(
	proof: Proof,
	expected: { kind: Proof['payload']['kind']; scope: string; after: number },
	trusted: Issuer[],
	now: number = Date.now()
): void {
	const value = proof.payload;
	const issuer = trusted.find(({ id }) => id === value.issuer);
	if (
		!issuer ||
		value.kind !== expected.kind ||
		value.scope !== expected.scope ||
		value.issuedAt < expected.after ||
		value.issuedAt > now ||
		value.expiresAt <= now
	) {
		throw new ExpectedCliError(
			'Deployment authorization is absent, stale, or scoped to a different operation.'
		);
	}
	const key = createPublicKey(issuer.publicKey);
	if (
		key.asymmetricKeyType !== 'ed25519' ||
		!verify(null, Buffer.from(canonical(value)), key, Buffer.from(proof.signature, 'base64url'))
	) {
		throw new ExpectedCliError('Deployment authorization signature is invalid.');
	}
}

export function verifyApproval(
	record: Plan,
	proof: Proof,
	registry: DeployRegistry,
	decision?: ApprovalReceipt
): void {
	const issuer = record.environment === 'staging' ? registry.stageAuthority : registry.daniel;
	verifyProof(proof, { kind: 'approval', scope: hash(record), after: record.createdAt }, [issuer]);
	if (
		registry.approvalInbox &&
		(record.environment !== 'staging' || decision) &&
		(!decision ||
			proof.payload.reference !== 'decision:' + decision.receipt ||
			proof.payload.issuedAt < decision.decidedAt - approvalClockSkewMs ||
			Date.now() >= record.createdAt + approvalWindowMs)
	)
		throw new ExpectedCliError('Deployment signature does not match a current exact decision.');
	if (proof.payload.expiresAt - proof.payload.issuedAt > 120_000) {
		throw new ExpectedCliError('Deployment approval has an excessive lifetime.');
	}
}

export function signoffScope(record: Journal): string {
	if (
		record.phase !== 'complete' ||
		!record.result ||
		!record.smoke ||
		!record.plan.release ||
		record.plan.action !== 'deploy'
	) {
		throw new ExpectedCliError(
			'Sign-off requires a completed deploy, including route smoke and cleanup.'
		);
	}
	return hash({ plan: record.plan, result: record.result, smoke: record.smoke });
}

export function verifySignoff(record: Journal, proof: Proof, registry: DeployRegistry): void {
	verifyProof(
		proof,
		{
			kind: 'signoff',
			scope: signoffScope(record),
			after: record.result?.observed.observedAt ?? record.plan.createdAt
		},
		registry.reviewers
	);
}
