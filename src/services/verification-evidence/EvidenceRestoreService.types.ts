export interface Restored {
	restored: string[];
	/** Attached records that could not be restored, each with what is wrong with it. */
	skipped: Array<{ record: string; problems: string[] }>;
}
