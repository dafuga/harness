// @harness-uid u_qb5hhfkfec
import { z } from 'zod';

export const deployApprovalPath = '/api/deploy-approvals';
export const approvalWindowMs = 300_000;
export const approvalClockSkewMs = 5000;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const revision = z.string().regex(/^[a-f0-9]{40}$/);
const identity = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/);
export const approvalScope = z.strictObject({
	project: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
	environment: z.enum(['staging', 'preprod', 'prod'])
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
	action: z.enum(['deploy', 'rollback', 'signoff']),
	target: identity,
	source: revision,
	release: digest.nullable(),
	artifact: digest.nullable(),
	parity: digest,
	allowedDifferences: z.number().int().nonnegative(),
	smoke: z.string().regex(/^scripts\/[\w./-]{1,160}$/),
	manifest: digest,
	predecessor: z
		.strictObject({ id: z.uuid(), signoff: digest, smoke: z.array(identity).min(1).max(250) })
		.nullable(),
	rollback: routeVersion,
	control: z
		.strictObject({
			run: z.uuid(),
			review: z
				.strictObject({ reference: identity, checks: z.array(identity).min(1).max(250) })
				.optional(),
			rollbackFrom: z.uuid().optional(),
			preview: z
				.strictObject({
					blocked: z.boolean(),
					fields: z.array(z.string().regex(/^[\w.:-]{1,260}$/)).max(250)
				})
				.optional()
		})
		.optional(),
	expiresAt: z.number().int().positive()
});
export const approvalReceipt = z.strictObject({
	...attempt.shape,
	receipt: z.uuid(),
	actor: identity,
	decision: z.enum(['allow', 'deny']),
	decidedAt: z.number().int().positive()
});
export const approvalDecision = attempt.extend({ decision: z.enum(['allow', 'deny', 'go']) });
export const goReceipt = attempt.extend({ goAt: z.number().int().positive() });
const providerReceipt = z.strictObject({ operation: identity, version: identity });
const verifiedReceipt = providerReceipt.extend({ checks: z.array(identity).min(1).max(250) });
export const deployProgress = z.discriminatedUnion('phase', [
	z.strictObject({ phase: z.enum(['stopped', 'applying', 'not-applied']) }),
	providerReceipt.extend({ phase: z.literal('deployed') }),
	verifiedReceipt.extend({ phase: z.enum(['verified', 'complete', 'cleanup-failed']) }),
	z.strictObject({ phase: z.literal('signed-off'), reference: identity })
]);
export const approvalCards = z.array(
	approvalCard.extend({
		receipt: approvalReceipt.nullable(),
		used: z.boolean(),
		goAt: z.number().int().positive().optional(),
		progress: deployProgress.optional()
	})
);
const scopedAttempt = { ...approvalScope.shape, ...attempt.shape };
export const runnerInput = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('register'), card: approvalCard }),
	z.strictObject({ kind: z.literal('collect'), ...scopedAttempt }),
	z.strictObject({ kind: z.literal('admit'), ...scopedAttempt }),
	z.strictObject({ kind: z.literal('report'), ...scopedAttempt, progress: deployProgress })
]);
