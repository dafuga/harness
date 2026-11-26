// @harness-uid u_r7qgepnoax
export function trackerRequestTimeout(path: string) {
	if (path.startsWith('/adapters/run?') || path === '/backup/now') return 120_000;
	return path.endsWith('/launch?outcome=run') ? 30_000 : 15_000;
}
