// @harness-uid u_r7qgepnoax
import type { TrackerNodeConfig } from '../../../services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import type { NativeTrackerRequest } from './nativeTrackerCli.types';
import { trackerRequestTimeout } from './trackerRequestTimeout';

/** One request to this computer's Tracker service, made in the name of `actor`. */
export async function fetchNativeTracker(
	config: TrackerNodeConfig,
	request: NativeTrackerRequest,
	actor: string
) {
	return fetch(`http://127.0.0.1:${config.apiPort}/native/v1${request.path}`, {
		method: request.method,
		body: JSON.stringify(request.body),
		headers: {
			'content-type': 'application/json',
			'x-tracker-as': actor.replace(/[^\x20-\x7e]/g, '?').slice(0, 80),
			'x-harness-tracker-node': config.node,
			'x-harness-tracker-role': config.role
		},
		redirect: 'error',
		// Bun's own five minute limit would cut off a long job test; the signal bounds the wait.
		...({ timeout: false } as object),
		signal: AbortSignal.timeout(trackerRequestTimeout(request.path))
	});
}
