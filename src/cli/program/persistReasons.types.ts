export interface PersistedReasons {
	commit: string;
	/** The revision the changes are measured from; null for an empty starting point. */
	base: string | null;
	/** Reasons now noted on the commit. */
	attached: number;
	/** Changes in the range that still have no reason; nothing is written for them. */
	missing: string[];
}
