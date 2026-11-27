// @harness-uid u_r7qgepnoax
export function trackerRequestTimeout(path: string) {
	// A job test waits for the job, whose own timeout is at most an hour.
	if (path === '/coordination/claim') return 50_000;
	if (/^\/jobs\/[^/]+\/test$/.test(path)) return 3_610_000;
	if (/^\/adapters\/(?:run|add)\?/.test(path) || path === '/backup/now') return 120_000;
	return path.endsWith('/launch?outcome=run') ? 30_000 : 15_000;
}
