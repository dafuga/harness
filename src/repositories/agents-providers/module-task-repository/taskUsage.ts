import { z } from 'zod';
const count = z.number().finite().nonnegative().nullable();
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
export const taskExecutionSchema = z.strictObject({
	provider: z.enum(['claude', 'codex']),
	model: z.string(),
	intelligence: z.string(),
	reportedModel: z.string().nullable(),
	usage: taskUsageSchema.optional(),
	apiCost: taskCostSchema,
	status: z.enum(['succeeded', 'failed']),
	startedAt: z.iso.datetime(),
	finishedAt: z.iso.datetime()
});
export const reviewInputSchema = z
	.strictObject({
		attempt: z.uuid(),
		verdict: z.enum(['accepted', 'incomplete']),
		reviewer: z.string().trim().min(1).max(150).default('unattributed'),
		feedback: z.string().trim().max(16000).default('')
	})
	.refine(
		(value) => value.verdict === 'accepted' || value.feedback.length > 0,
		'Incomplete review requires feedback.'
	);
export const taskReviewSchema = z.strictObject({
	attempt: z.uuid(),
	verdict: z.enum(['accepted', 'incomplete']),
	reviewer: z.string(),
	feedback: z.string(),
	at: z.iso.datetime(),
	provider: z.enum(['claude', 'codex']),
	model: z.string(),
	intelligence: z.string(),
	reportedModel: z.string().nullable()
});
