import type { RevisionRange } from './loadRevisions';
import type { ReasonStatus } from '../../core/development-tooling/explanationTypes';

export interface ExplainInput extends RevisionRange {
	all?: boolean;
	unit?: string;
	symbol?: string[];
	behavior?: string;
	simplification?: string;
	simplificationOutcome?: string;
	performance?: string;
	performanceOutcome?: string;
	/** Also writes a reason for a change whose stored reason exceeds the writing limits. */
	replace?: boolean;
	now?: () => string;
}

export type Listed = Omit<ReasonStatus, 'from' | 'to'>;
