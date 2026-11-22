// @harness-uid u_wwerrde2nk
import { z } from 'zod';

export const bugClassId = z
	.string()
	.regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/)
	.max(80);
const statement = (limit: number) => z.string().trim().min(1).max(limit);

export const searchPatternSchema = z.strictObject({
	kind: z.enum(['text', 'call', 'construct']),
	value: statement(100),
	weight: z.number().int().min(1).max(5)
});

export const bugClassSchema = z.strictObject({
	id: bugClassId,
	title: statement(110),
	cause: statement(500),
	criteria: statement(700),
	patterns: z.array(searchPatternSchema).min(1).max(30),
	contextTerms: z.array(statement(70)).max(20),
	pathHints: z
		.array(
			z.strictObject({
				contains: statement(120),
				weight: z.number().int().min(-10).max(10)
			})
		)
		.max(16)
});

export const classRecordSchema = z.strictObject({
	schemaVersion: z.literal(1),
	revision: z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/),
	bugClass: bugClassSchema
});

export const candidateVerdictSchema = z.strictObject({
	id: statement(40),
	verdict: z.enum(['confirmed', 'unconfirmed', 'dismissed']),
	impact: z.number().int().min(0).max(5),
	evidence: statement(550)
});

export const candidateReviewSchema = z.strictObject({
	results: z.array(candidateVerdictSchema).max(12)
});

export const repairReviewSchema = z.strictObject({
	accepted: z.boolean(),
	evidence: statement(700)
});

export const workerTestSchema = z.strictObject({
	tests: z.array(statement(350)).min(1).max(20),
	assertion: statement(400)
});
