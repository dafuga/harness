import type { z } from 'zod';
import type { explanationSchema, explanationOutcomes } from './explanationTypes';

export type Explanation = z.infer<typeof explanationSchema>;

export type ExplanationOutcome = (typeof explanationOutcomes)[number];

/** One change that needs a reason. */
export interface RequiredReason {
	unit: string;
	symbol: string;
	file?: string;
	change: 'added' | 'modified' | 'removed';
	from: string | null;
	to: string | null;
}

export interface ReasonStatus extends RequiredReason {
	state: 'explained' | 'missing' | 'stale';
}
