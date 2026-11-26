// @harness-uid u_eobosugyrh
/** How long the CLI waits for the local service to answer one command. */
export function trackerRequestTimeout(path: string): number {
	if (path.startsWith('/adapters/run?')) return 120_000;
	// A job test waits for the job, whose own timeout is at most an hour.
	if (/^\/jobs\/[^/]+\/test$/.test(path)) return 3_610_000;
	return path.endsWith('/launch?outcome=run') ? 30_000 : 15_000;
}
