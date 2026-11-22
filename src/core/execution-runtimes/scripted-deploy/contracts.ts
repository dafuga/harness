// @harness-uid u_mo4ka6dupc
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { CanonicalValue } from './contracts.types';

export const name = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
export const sha = z.string().regex(/^[a-f0-9]{40}$/);
export const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const runId = z.string().uuid();
export const reference = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/);
export const environment = z.enum(['staging', 'preprod', 'prod']);
export const action = z.enum(['deploy', 'rollback']);
export const pathFromRoot = z
	.string()
	.regex(/^[\w.-]+(\/[\w.-]+)*$/)
	.refine((value) => value.split('/').every((part) => part !== '..' && part !== '.'));
const names = z.array(reference).max(250);
const values = z.record(reference, z.string().max(180));

export const migrations = z.array(z.strictObject({ name: reference, digest })).max(250);

export const profile = z.strictObject({
	bindings: values,
	secretNames: names,
	migrations,
	runtimes: values,
	flags: values
});

export const observation = z.strictObject({
	target: reference,
	version: reference,
	source: sha,
	artifact: digest.nullable(),
	observedAt: z.number().int().positive(),
	profile
});

export const release = z.strictObject({
	id: digest,
	project: name,
	source: sha,
	artifact: digest,
	manifest: digest,
	image: z.string(),
	size: z.number().int().positive(),
	migrations
});

export const plan = z.strictObject({
	id: runId,
	project: name,
	environment,
	action,
	target: reference,
	release: release.nullable(),
	previous: observation,
	restore: observation.nullable(),
	predecessor: runId.nullable(),
	signoff: digest.nullable(),
	parity: digest,
	manifest: digest,
	item: reference,
	createdAt: z.number().int().positive()
});

export const signedProof = z.strictObject({
	payload: z.strictObject({
		issuer: reference,
		kind: z.enum(['approval', 'signoff']),
		scope: digest,
		issuedAt: z.number().int().positive(),
		expiresAt: z.number().int().positive(),
		reference
	}),
	signature: z.string().regex(/^[\w-]{86}$/)
});

export const deployment = z.strictObject({ operation: reference, observed: observation });
export const smoke = z.strictObject({
	version: reference,
	source: sha,
	artifact: digest.nullable(),
	checks: names.min(1)
});
export const journal = z.strictObject({
	plan,
	phase: z.enum([
		'pending',
		'applying',
		'deployed',
		'verified',
		'complete',
		'cleanup-failed',
		'not-applied'
	]),
	approval: signedProof.optional(),
	result: deployment.optional(),
	smoke: smoke.optional(),
	signoff: signedProof.optional()
});

export type {
	Environment,
	Observation,
	Profile,
	Release,
	Plan,
	Journal,
	Proof,
	Deployment,
	Smoke
} from './contracts.types';

export function canonical(value: CanonicalValue): string {
	if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	const fields = Object.entries(value).sort(([left], [right]) =>
		Buffer.compare(Buffer.from(left), Buffer.from(right))
	);
	return (
		'{' + fields.map(([key, val]) => JSON.stringify(key) + ':' + canonical(val)).join(',') + '}'
	);
}

export function hash(value: CanonicalValue): string {
	return createHash('sha256').update(canonical(value)).digest('hex');
}
