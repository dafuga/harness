// @harness-uid u_r7qgepnoax
export function trackerRequestTimeout(path: string) {
	// A job test waits for the job, whose own timeout is at most an hour.
	if (/^\/jobs\/[^/]+\/test$/.test(path)) return 3_610_000;
	if (path.startsWith('/adapters/run?') || path === '/backup/now') return 120_000;
	return path.endsWith('/launch?outcome=run') ? 30_000 : 15_000;
}
