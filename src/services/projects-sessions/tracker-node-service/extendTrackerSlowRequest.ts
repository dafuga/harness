// @harness-uid u_v6dqmp4c74
/** Commands that wait on external work outlive the listener's default idle timeout. */
export function extendTrackerSlowRequest(request: Request, server: Bun.Server<undefined>): void {
	const { pathname } = new URL(request.url);
	if (/\/adapters\/run$/.test(pathname)) server.timeout(request, 120);
	// A job test lasts as long as its own timeout, which can exceed Bun's idle limit.
	if (/\/jobs\/[^/]+\/test$/.test(pathname)) server.timeout(request, 0);
}
