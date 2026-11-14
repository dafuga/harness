// @harness-uid u_34r2rrehaa
const second = 1000;
const minute = 60 * second;
const hour = 60 * minute;

/**
 * Named deadlines for child commands. An asynchronous command has no short implicit deadline:
 * a call site that needs one states it, and a workload that states none gets `backstopMs`.
 */
export const commandDeadlines = {
	/** Backstop for an asynchronous command that states no deadline; never a working limit. */
	backstopMs: 6 * hour,
	/** Synchronous direct probes block their caller, so their default stays short. */
	syncProbeMs: 60 * second,
	/** Git work that stays inside the local repository. */
	localGitMs: 30 * minute,
	/** Git work that uses the network or LFS, runs hooks, or rewrites a work tree. */
	longGitMs: 6 * hour,
	/** Loop evaluators run whole project checks; an evaluator may declare its own `timeoutMs`. */
	evaluatorMs: 6 * hour,
	/** Benchmark children stop on their trial budget signal; this is the largest budget allowed. */
	benchmarkChildMs: 24 * hour,
	/** One fresh-process kernel sample, or one measured native run. */
	kernelSampleMs: 60 * second
} as const;
