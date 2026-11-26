import type { TrackerResponseBody, TrackerResponseFailure } from './trackerLocalResponse.types';

// @harness-uid u_4g5xqncyph
/** Responses of the loopback item API. Only client errors expose their message. */
export function trackerFailureResponse(error: TrackerResponseFailure): Response {
	if (
		error instanceof Error &&
		'status' in error &&
		typeof error.status === 'number' &&
		error.status >= 400 &&
		error.status < 500
	) {
		const extra = 'body' in error && typeof error.body === 'object' ? error.body : {};
		return trackerResponse(error.status, { error: error.message, ...extra });
	}
	return trackerResponse(500, { error: 'internal server error' });
}

export function trackerResponse(status: number, body: TrackerResponseBody): Response {
	const isText = typeof body === 'string';
	return new Response(isText ? body + '\n' : JSON.stringify(body, null, 2), {
		status,
		headers: { 'content-type': isText ? 'text/plain; charset=utf-8' : 'application/json' }
	});
}
