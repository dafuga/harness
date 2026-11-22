// @harness-uid u_tjumni44tf
import { z } from 'zod';
const count = z.number().finite().nonnegative().nullable();
const reviewCause = z.enum([
	'contract',
	'verification',
	'scope',
	'quality',
	'user-correction',
	'other'
]);
export const executionFailureCause = z.enum(['quota', 'timeout', 'cancelled', 'provider-error']);
export const taskUsageSchema = z.strictObject({
	inputTokens: count,
	outputTokens: count,
	cacheReadTokens: count,
	cacheWriteTokens: count,
	cacheWriteLongTokens: count.optional(),
	reportedCostUsd: count,
	reasoningTokens: count.optional()
});
export const taskCostSchema = z.strictObject({
	usd: count,
	minimumUsd: count,
	maximumUsd: count,
	basis: z.enum(['cli-reported', 'standard-api-estimate', 'unavailable']),
	rateCard: z.string(),
	source: z.string().nullable(),
	note: z.string()
});
export const taskSessionMetricSchema = z.strictObject({
	status: z.enum(['rotated', 'hard-limit', 'succeeded', 'failed', 'interrupted']),
	sessionId: z.string().nullable(),
	peakContextTokens: z.number().int().nonnegative().nullable(),
	preRequestEstimateTokens: z.number().int().nonnegative().optional(),
	usage: taskUsageSchema.optional(),
	apiCost: taskCostSchema,
	startedAt: z.iso.datetime(),
	finishedAt: z.iso.datetime()
});
export const taskExecutionSchema = z.strictObject({
	provider: z.enum(['claude', 'codex']),
	model: z.string(),
	intelligence: z.string(),
	reportedModel: z.string().nullable(),
	usage: taskUsageSchema.optional(),
	sessions: z.array(taskSessionMetricSchema).optional(),
	apiCost: taskCostSchema,
	status: z.enum(['succeeded', 'failed']),
	failureCause: executionFailureCause.optional(),
	startedAt: z.iso.datetime(),
	finishedAt: z.iso.datetime()
});
export const reviewInputSchema = z
	.strictObject({
		attempt: z.uuid(),
		verdict: z.enum(['accepted', 'incomplete']),
		cause: reviewCause.optional(),
		reviewer: z.string().trim().min(1).max(150).default('unattributed'),
		feedback: z.string().trim().max(16000).default(''),
		evidence: z.string().trim().min(1).max(200).optional()
	})
	.refine(
		(value) => value.verdict === 'accepted' || value.feedback.length > 0,
		'Incomplete review requires feedback.'
	)
	.refine(
		(value) => value.verdict === 'incomplete' || value.evidence !== undefined,
		'Accepted review requires --evidence: a verified commit that carries the submission.'
	)
	.refine(
		(value) => value.verdict === 'incomplete' || value.cause === undefined,
		'Only incomplete reviews can specify a rejection cause.'
	);
export const taskReviewSchema = z.strictObject({
	attempt: z.uuid(),
	verdict: z.enum(['accepted', 'incomplete']),
	cause: reviewCause.optional(),
	reviewer: z.string(),
	feedback: z.string(),
	at: z.iso.datetime(),
	provider: z.enum(['claude', 'codex']),
	model: z.string(),
	intelligence: z.string(),
	reportedModel: z.string().nullable(),
	evidence: z
		.strictObject({
			commit: z.string().regex(/^[a-f0-9]{40}$/),
			record: z.string().min(1),
			scope: z.enum(['full', 'entity']),
			checks: z.number().int().nonnegative()
		})
		.optional()
});
