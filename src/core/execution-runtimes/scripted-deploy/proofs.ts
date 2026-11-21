import { createPublicKey, verify } from 'node:crypto';
import { hash, canonical, type Journal, type Plan, type Proof } from './contracts';
import type { DeployRegistry } from '../../../validators/execution-runtimes/DeployManifestValidator';

type Issuer = DeployRegistry['daniel'];

export function verifyProof(
	proof: Proof,
	expected: { kind: Proof['payload']['kind']; scope: string; after: number },
	trusted: Issuer[],
	now = Date.now()
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
		throw new Error(
			'Deployment authorization is absent, stale, or scoped to a different operation.'
		);
	}
	const key = createPublicKey(issuer.publicKey);
	if (
		key.asymmetricKeyType !== 'ed25519' ||
		!verify(null, Buffer.from(canonical(value)), key, Buffer.from(proof.signature, 'base64url'))
	) {
		throw new Error('Deployment authorization signature is invalid.');
	}
}

export function verifyApproval(record: Plan, proof: Proof, registry: DeployRegistry): void {
	const issuer = record.environment === 'staging' ? registry.stageAuthority : registry.daniel;
	verifyProof(proof, { kind: 'approval', scope: hash(record), after: record.createdAt }, [issuer]);
	if (proof.payload.expiresAt - proof.payload.issuedAt > 120_000) {
		throw new Error('Deployment approval has an excessive lifetime.');
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
		throw new Error('Sign-off requires a completed deploy, including route smoke and cleanup.');
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
