import { z } from 'zod';

export const deployApprovalPath = '/api/deploy-approvals';
export const approvalWindowMs = 300_000;
export const approvalClockSkewMs = 5000;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const revision = z.string().regex(/^[a-f0-9]{40}$/);
const identity = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/);
export const approvalScope = z.strictObject({
	project: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
	environment: z.enum(['preprod', 'prod'])
});
const attempt = z.strictObject({ id: z.uuid(), plan: digest });
const routeVersion = z.strictObject({
	target: identity,
	version: identity,
	source: revision,
	artifact: digest.nullable()
});
export const approvalCard = z.strictObject({
	...approvalScope.shape,
	...attempt.shape,
	action: z.enum(['deploy', 'rollback']),
	target: identity,
	source: revision,
	release: digest.nullable(),
	artifact: digest,
	parity: digest,
	allowedDifferences: z.number().int().nonnegative(),
	smoke: z.string().regex(/^scripts\/[\w./-]{1,160}$/),
	manifest: digest,
	predecessor: z
		.strictObject({ id: z.uuid(), signoff: digest, smoke: z.array(identity).min(1).max(250) })
		.nullable(),
	rollback: routeVersion,
	expiresAt: z.number().int().positive()
});
export const approvalReceipt = z.strictObject({
	...attempt.shape,
	receipt: z.uuid(),
	actor: identity,
	decision: z.enum(['allow', 'deny']),
	decidedAt: z.number().int().positive()
});
export const approvalDecision = approvalReceipt.pick({ id: true, plan: true, decision: true });
export const approvalCards = z.array(
	approvalCard.extend({ receipt: approvalReceipt.nullable(), used: z.boolean() })
);
export const runnerInput = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('register'), card: approvalCard }),
	z.strictObject({ kind: z.literal('collect'), ...approvalScope.shape, ...attempt.shape })
]);
