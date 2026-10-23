export interface SnapshotDrift {
	/** Tracked files that were changed or deleted, and shared links that were replaced. */
	mutated: string[];
	/** Files the commit does not contain and no output declaration covers. */
	added: string[];
}
