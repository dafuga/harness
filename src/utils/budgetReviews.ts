import type { BudgetEvent } from '../core/budgetTypes';

/** One reviewed line of the ledger as a history shows it, at the commit whose record it cites. */
export interface BudgetReview {
	type: BudgetEvent['type'];
	/** The commit that was measured, which is where the size was what the review accepted. */
	commit: string;
	record: string;
	reviewer: string;
	reason: string;
	at: string;
	/** The limits the unit had before an approval; a baseline had none. */
	before?: Record<string, number>;
	after: Record<string, number>;
	unmeasured?: Record<string, string>;
}

/** The limits one revision freezes for what a unit emits, by execution target. */
export interface EmittedLimits {
	limits: Record<string, number>;
	/** Targets whose output could not be built when the limits were reviewed, each with why. */
	unmeasured?: Record<string, string>;
}

/** The limits a revision holds for the source of a unit, by metric. */
export interface FrozenLimits {
	metrics: Record<string, number>;
	unmeasured?: Record<string, string>;
}

export { budgetReviews } from '../cli/program/history-index-service/budgetReviews';
export { frozenLimits, emittedLimits } from './revision-registry/frozenLimits';
