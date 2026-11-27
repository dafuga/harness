// @harness-uid u_57drtxvxop
import { z } from 'zod';

const price = z.strictObject({
	input: z.number().nonnegative(),
	output: z.number().nonnegative(),
	cacheRead: z.number().nonnegative(),
	cacheWrite: z.number().nonnegative()
});

const provider = z.enum(['claude', 'codex']);
export const trackerPreferredProviderSchema = z.union([
	z.strictObject({ provider }),
	z.strictObject({ provider, until: z.iso.datetime({ offset: true }), then: provider.optional() })
]);

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
	preferredProvider: trackerPreferredProviderSchema.optional()
});
