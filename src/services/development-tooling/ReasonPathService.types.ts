import type { ReasonSide } from '../../utils/development-tooling/required-reasons/requiredReasons';

export interface ReasonRange {
	base: ReasonSide;
	head: ReasonSide;
	/** Null when the range starts from nothing. */
	baseCommit: string | null;
	/** Null when the head is the working tree. */
	headCommit: string | null;
}

/** Reads one commit as a side of a comparison. */
export type SideLoader = (commit: string) => Promise<ReasonSide>;
