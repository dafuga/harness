// @harness-uid u_gvqtr5mdwv
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';
import type { TrackerSupervisorService } from '../TrackerSupervisorService';
import { trackerLaunchAwareItemResponse } from './confirmTrackerLaunch';
import { readTrackerNodeInspection } from './readTrackerNodeInspection';

const providerPath = '/autolaunch/provider';
const commands = new Set([
	'/autolaunch/pause',
	'/autolaunch/resume',
	'/autolaunch/clear-quota',
	providerPath
]);

/** Routes without a fixed case: launch switches, read-only inspections, then items. */
export function trackerCommandOrItemResponse(
	request: Request,
	path: string,
	runtime: TrackerNativeRuntimeService,
	supervisor: TrackerSupervisorService
) {
	if (request.method === 'POST' && commands.has(path))
		return runTrackerAutolaunchCommand(request, path, runtime);
	if (request.method === 'GET' && path === providerPath)
		return Response.json(runtime.admin.provider.read());
	const inspection =
		request.method === 'GET' ? readTrackerNodeInspection(path, runtime, supervisor) : undefined;
	return inspection ?? trackerLaunchAwareItemResponse(request, runtime);
}

async function runTrackerAutolaunchCommand(
	request: Request,
	path: string,
	{ admin }: TrackerNativeRuntimeService
): Promise<Response> {
	try {
		if (path === '/autolaunch/pause' || path === '/autolaunch/resume')
			return Response.json(admin.pauseDue(path === '/autolaunch/pause'));
		const body = (await request.json().catch(() => null)) as {
			provider?: unknown;
			setting?: unknown;
		} | null;
		if (path === providerPath) return Response.json(admin.provider.update(body?.setting));
		return Response.json(admin.clearQuota(body?.provider));
	} catch (error) {
		if (error instanceof Error && 'status' in error && typeof error.status === 'number')
			return Response.json({ error: error.message }, { status: error.status });
		throw error;
	}
}
