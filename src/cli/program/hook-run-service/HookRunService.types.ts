export interface HookOutcome {
	/** Commits that may be pushed, each with the record that proves it. */
	verified: Array<{ commit: string; record: string }>;
	/** Commits that may not be pushed, each with what failed. */
	blocked: Array<{ commit: string; failures: string[] }>;
}
