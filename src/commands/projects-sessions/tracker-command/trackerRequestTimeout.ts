// @harness-uid u_r7qgepnoax
export function trackerRequestTimeout(path: string) {
	if (/^\/adapters\/(?:run|add)\?/.test(path) || path === '/backup/now') return 120_000;
	return path.endsWith('/launch?outcome=run') ? 30_000 : 15_000;
}
