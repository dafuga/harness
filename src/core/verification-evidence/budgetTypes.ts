import { z } from 'zod';
import { comparisonSchema } from '../development-tooling/comparisonTypes';
import { runtimeKinds, unitIdPattern } from '../development-tooling/unitTypes';

const text = z.string().trim().min(1);
const commit = z.string().regex(/^[0-9a-f]{40}$/);
const metrics = z.record(z.string(), z.number());
/** Frozen metrics that could not be measured when the limits were reviewed, each with why. */
const unmeasured = z.record(z.string(), text).optional();

/**
 * A frozen performance value together with its whole definition. The workload name is a label;
 * the unit, the method and the comparison context are what a later measurement must match.
 */
export const performanceBaselineSchema = z.strictObject({
	workload: text,
	metric: text,
	target: z.enum(runtimeKinds),
	profile: text,
	value: z.number(),
	unitOfMeasure: text,
	method: text,
	comparison: comparisonSchema
});

/** The clean verification record a limit was measured by; never the commit that stores it. */
const recordReference = z.strictObject({ id: text, commit, tree: commit });
const signed = {
	unit: z.string().regex(unitIdPattern),
	record: recordReference,
	reviewer: text,
	reason: text,
	at: text
};

/**
 * One line of the append-only budget ledger. A baseline freezes a new unit's limits; an approval
 * records a reviewed change with the limits before and after.
 */
export const budgetEventSchema = z.discriminatedUnion('type', [
	z.strictObject({
		type: z.literal('baseline'),
		...signed,
		metrics,
		unmeasured,
		performance: z.array(performanceBaselineSchema)
	}),
	z.strictObject({
		type: z.literal('approval'),
		...signed,
		before: metrics,
		after: metrics,
		unmeasured,
		performance: z.array(performanceBaselineSchema)
	})
]);

export type BudgetEvent = z.infer<typeof budgetEventSchema>;
export type PerformanceBaselineEntry = z.infer<typeof performanceBaselineSchema>;
