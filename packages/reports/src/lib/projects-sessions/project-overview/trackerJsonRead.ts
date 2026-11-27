// @harness-uid u_3spz5aua5q
import { TrackerReadError } from './TrackerReadError';
import { TRACKER_GET_URLS, TRACKER_TIMEOUT_MS } from './trackerReadTargets';

/** Fixed loopback GETs with one deadline, no redirects and no credentials. */
export async function getTrackerJson(fetcher: typeof fetch, url: string): Promise<unknown> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const expired = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => {
			controller.abort();
			reject(new TrackerReadError('tracker read timed out'));
		}, TRACKER_TIMEOUT_MS);
	});
	try {
		const read = (target: string) =>
			Promise.race([
				fetcher(target, {
					method: 'GET',
					redirect: 'error',
					cache: 'no-store',
					credentials: 'omit',
					headers: { accept: 'application/json' },
					signal: controller.signal
				}),
				expired
			]);
		const response = await read(url);
		if (url === TRACKER_GET_URLS.machines && response.status === 404) {
			await closeBody(response);
			const status = await readTrackerResponse(await read(TRACKER_GET_URLS.status), expired);
			return statusMachines(status);
		}
		return await readTrackerResponse(response, expired);
	} finally {
		clearTimeout(timer);
	}
}

function statusMachines(status: unknown): unknown {
	if (typeof status !== 'object' || status === null || Array.isArray(status)) {
		throw new TrackerReadError('malformed tracker status');
	}
	return (status as Record<string, unknown>).machines;
}

async function readTrackerResponse(response: Response, expired: Promise<never>): Promise<unknown> {
	if (!response.ok) {
		await closeBody(response);
		throw new TrackerReadError('tracker read failed');
	}
	return Promise.race([response.json(), expired]);
}

async function closeBody(response: Response): Promise<void> {
	try {
		await response.body?.cancel();
	} catch {
		// The body was already closed or locked; nothing else to release.
	}
}
