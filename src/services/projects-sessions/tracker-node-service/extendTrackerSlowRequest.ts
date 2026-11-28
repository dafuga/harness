// @harness-uid u_v6dqmp4c74
import { trackerSlowAdapterPath } from './trackerAdapterRoutes';

/** Commands that wait on external work outlive the listener's default idle timeout. */
export function extendTrackerSlowRequest(request: Request, server: Bun.Server<undefined>): void {
	const { pathname } = new URL(request.url);
	if (pathname.endsWith('/coordination/claim')) server.timeout(request, 50);
	if (trackerSlowAdapterPath.test(pathname)) server.timeout(request, 120);
	// A job test lasts as long as its own timeout, which can exceed Bun's idle limit.
	if (/\/jobs\/[^/]+\/test$/.test(pathname)) server.timeout(request, 0);
}
