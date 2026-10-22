/** One reviewed line of the budget ledger, at the commit whose record it cites. */
export interface HarnessReview {
	type: 'baseline' | 'approval';
	commit: string;
	record: string;
	reviewer: string;
	reason: string;
	at: string;
	/** The limits the unit had before an approval, by the name each is frozen under. */
	before?: Record<string, number>;
	after: Record<string, number>;
	unmeasured?: Record<string, string>;
}

/** The limits the ledger of a revision holds for the source of a unit, by metric. */
export interface HarnessFrozenLimits {
	metrics: Record<string, number>;
	/** Metrics that could not be measured when the limits were reviewed, each with why. */
	unmeasured?: Record<string, string>;
}

/** The limits a revision freezes for what a unit emits, by execution target. */
export interface HarnessEmittedLimits {
	limits: Record<string, number>;
	/** Targets whose output could not be built when the limits were reviewed, each with why. */
	unmeasured?: Record<string, string>;
}

/** What the view of a unit at one revision says about its reviewed limits; both parts may be absent. */
export interface HarnessUnitLimits {
	/** For a unit that emits outputs: the limit of each execution target. */
	emitted?: HarnessEmittedLimits;
	/** The source limits, when the unit has a reviewed baseline at that revision. */
	limits?: HarnessFrozenLimits;
}
