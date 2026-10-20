import type { HarnessReview } from '../models/HarnessBudget.types';

export interface EmittedCell {
	value?: number;
	/** Change since the last commit that had a size for this target. */
	delta?: number;
	/** Why there is no size at this commit. */
	note?: string;
	/** The limit the commit was verified under: the one reviewed before it. */
	limit?: number;
	/** Why no limit applied although the target was reviewed. */
	unlimited?: string;
}

export interface EmittedReview {
	type: HarnessReview['type'];
	reviewer: string;
	reason: string;
	/** What the review said about each target, in words: its size, or the sizes before and after. */
	changes: string[];
}

export interface EmittedRow {
	commit: string;
	subject: string;
	cells: Record<string, EmittedCell>;
	/** The reviews that measured this commit: its first baseline, or the approval of its growth. */
	reviews: EmittedReview[];
	/** True when a size differs from the commit before, appears or is gone. */
	changed: boolean;
}

export interface EmittedGrowth {
	targets: Array<{ id: string; label: string }>;
	rows: EmittedRow[];
}

export { harnessEmittedGrowth } from '../components/harness/harness-growth/harnessEmittedGrowth';
