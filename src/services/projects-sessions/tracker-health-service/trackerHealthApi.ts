// @harness-uid u_lkwi7fkv3c
import { TrackerHealthHttpError } from './TrackerHealthHttpError';
import type { TrackerNodeConfig } from '../tracker-node-service/trackerNodeConfig.types';
import type { TrackerHealthStatus } from '../TrackerHealthService.types';
import type { TrackerHealthApiResult } from './trackerHealthApi.types';

/** One request, bound to this node's identity, to this node's loopback API. */
export async function trackerHealthRequest(
	config: TrackerNodeConfig,
	path: string,
	body?: object
): Promise<unknown> {
	const response = await fetch(`http://127.0.0.1:${config.apiPort}/native/v1${path}`, {
		method: body ? 'POST' : 'GET',
		body: body && JSON.stringify(body),
		headers: {
			'content-type': 'application/json',
			'x-tracker-as': 'tracker-health',
			'x-harness-tracker-node': config.node,
			'x-harness-tracker-role': config.role
		},
		redirect: 'error',
		signal: AbortSignal.timeout(10_000)
	});
	if (!response.ok) throw new TrackerHealthHttpError(`HTTP ${response.status}`);
	return response.json();
}

export async function trackerHealthApiCheck(
	config: TrackerNodeConfig
): Promise<TrackerHealthApiResult> {
	const name = 'api';
	try {
		const status = (await trackerHealthRequest(config, '/status')) as TrackerHealthStatus;
		const detail = `${config.role} ${config.node} answering (pid ${status.pid ?? '?'})`;
		return { status, check: { name, ok: true, severity: 'fail', detail } };
	} catch (error) {
		const cause =
			error instanceof TrackerHealthHttpError && /^HTTP \d+$/.test(error.message)
				? error.message
				: '';
		const detail = `Tracker API on port ${config.apiPort} is not answering${cause && ` (${cause})`}`;
		return { check: { name, ok: false, severity: 'fail', detail } };
	}
}
