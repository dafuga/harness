// @harness-uid u_sbz3zzk4fx
export interface CheckPart {
	steps: readonly string[];
	/** The slice of the test:e2e files this part runs, as vitest's index/total. */
	vitestShard?: string;
}
