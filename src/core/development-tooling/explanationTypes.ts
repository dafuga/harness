import { z } from 'zod';
import { unitIdPattern } from './unitTypes';

/** Scratch store for reasons written before a commit exists; never part of the source tree. */
export const explanationsFile = '.cache/harness/explanations.ndjson';
export const explanationOutcomes = ['improved', 'not-improved', 'not-applicable'] as const;

const text = z.string().trim().min(1);
const attempt = z.strictObject({ attempt: text, outcome: z.enum(explanationOutcomes) });

/**
 * Why one function or unit changed. `from` and `to` are content fingerprints, so a reason is
 * bound to the exact change it explains and goes stale when the code changes again.
 */
export const explanationSchema = z.strictObject({
	unit: z.string().regex(unitIdPattern),
	/** Function name, `Class.method`, `<module>`, `<manifest>`, or `*` for a whole unit. */
	symbol: text,
	file: z.string().optional(),
	change: z.enum(['added', 'modified', 'removed']),
	from: z.string().nullable(),
	to: z.string().nullable(),
	behavior: text,
	/** What was tried to make the change simpler, and whether it worked. */
	simplification: attempt,
	/** What was tried for performance, including at the invocation boundary, and the result. */
	performance: attempt,
	recordedAt: text
});

export type {
	Explanation,
	ExplanationOutcome,
	RequiredReason,
	ReasonStatus
} from './explanationTypes.types';
