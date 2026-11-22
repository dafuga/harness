// @harness-uid u_bbdcde2lmc
import { json, type RequestEvent } from '@sveltejs/kit';
import { readProjectOverview } from '../../../lib/projects-sessions/project-overview/readProjectOverview';
import type { OverviewSnapshot } from '../../../lib/projects-sessions/project-overview/projectOverview.types';
import { consoleServer } from '../../../utils/explorer-ui/console-server/consoleServer';

const unavailable: OverviewSnapshot = { status: 'unavailable' };

/** Exact loopback Host values; a rebound name or a forwarded one never matches. */
const localHost = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d{1,5})?$/;

/** Headers a proxy writes; their presence means the request did not come straight from the owner. */
const forwarded = [
	'forwarded',
	'x-forwarded-for',
	'x-forwarded-host',
	'x-forwarded-proto',
	'x-forwarded-port',
	'x-real-ip'
];

/** Plain HTTP to the exact loopback origin the request names: its Host and its URL agree. */
function exactOrigin(event: RequestEvent): boolean {
	const host = event.request.headers.get('host')?.toLowerCase();
	if (!host || !localHost.test(host)) return false;
	return event.url.protocol === 'http:' && event.url.origin === `http://${host}`;
}

/** No proxy wrote the request, and no other site started it. */
function ownRequest(event: RequestEvent): boolean {
	const headers = event.request.headers;
	if (forwarded.some((name) => headers.has(name))) return false;
	const site = headers.get('sec-fetch-site');
	if (site && site !== 'same-origin' && site !== 'none') return false;
	const origin = headers.get('origin');
	return origin === null || origin === event.url.origin;
}

function local(event: RequestEvent): boolean {
	return exactOrigin(event) && ownRequest(event);
}

function answer(body: OverviewSnapshot, status: number): Response {
	return json(body, {
		status,
		headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
	});
}

/**
 * The Project Overview of this computer's tracker, read when the owner asks. It only reads: the
 * upstream is fixed by the reader, and a request that is not the owner's local one gets the same
 * unavailable answer as a tracker that cannot be reached, without any detail of why.
 */
export async function GET(event: RequestEvent): Promise<Response> {
	if (!local(event) || (await consoleServer().guard(event))) return answer(unavailable, 403);
	try {
		const snapshot = await readProjectOverview();
		return answer(snapshot, snapshot.status === 'ready' ? 200 : 503);
	} catch {
		return answer(unavailable, 503);
	}
}
