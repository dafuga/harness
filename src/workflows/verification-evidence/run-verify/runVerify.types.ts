export interface VerifyOptions {
	priority?: string;
	/** Mandatory for task completion; historical verification contracts remain readable. */
	requirePerformance?: boolean;
	root?: string;
	/** Commit to verify; `HEAD` by default. Uncommitted changes are never part of it. */
	commit?: string;
	/**
	 * Revision to compare against; the first parent by default. It is used only when a passing
	 * record proves it; otherwise the nearest proven ancestor is used, or nothing at all.
	 */
	base?: string;
	runtime?: string;
	testTimeout?: string;
	record?: string;
}
