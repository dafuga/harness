// @harness-uid u_57drtxvxop
import { z } from 'zod';
import { trackerTaskTypes } from '../../../utils/agents-providers/classifyTrackerTask.types';

const price = z.strictObject({
	input: z.number().nonnegative(),
	output: z.number().nonnegative(),
	cacheRead: z.number().nonnegative(),
	cacheWrite: z.number().nonnegative()
});

/** Model routing overrides. Learning only moves up, so there is no downward threshold. */
export const trackerRoutingSchema = z.strictObject({
	ladder: z
		.array(
			z.strictObject({
				id: z.enum(['haiku', 'terra', 'sol']),
				model: z.string().min(1).max(120),
				effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(),
				price: price.nullable().optional()
			})
		)
		.max(3)
		.optional(),
	learning: z
		.strictObject({
			minSamples: z.int().positive().max(1000).optional(),
			upBelow: z.number().min(0).max(1).optional()
		})
		.optional(),
	claudeOnlyUntil: z.iso.datetime({ offset: true }).optional(),
	taskRoutes: z
		.partialRecord(z.enum(trackerTaskTypes), z.array(z.string().min(1).max(160)).min(1).max(6))
		.optional(),
	gemini: z
		.strictObject({ enabled: z.boolean().optional(), model: z.string().min(1).max(120).optional() })
		.optional()
});
