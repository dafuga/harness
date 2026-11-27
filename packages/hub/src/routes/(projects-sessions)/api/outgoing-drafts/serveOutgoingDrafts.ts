// @harness-uid u_n6dmwj3gpk
import { readOverviewText } from '../../../api/tracker-overview/trackerOverviewBody';
import { hubHttpFailure } from '../../../api/[...path]/hub-api-controller/hubHttp';
import { forwardOutgoingDraft } from './outgoingGateway';
import type { OutgoingDraftDeps } from './serveOutgoingDrafts.types';

const path = '/api/outgoing-drafts';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const error = (status: number, code: string) => Response.json({ error: code }, { status, headers });
const admittedStatus = new Set([200, 400, 403, 404, 409, 413]);

/** Private to the owner. The Tracker grant and Access service credentials stay server-side. */
export async function serveOutgoingDrafts(request: Request, deps: OutgoingDraftDeps) {
	const url = new URL(request.url);
	if (url.pathname !== path || url.search || !deps.ownerId) return error(404, 'not-found');
	const session = await deps.sessions?.resolve(request);
	if (!session || session.actor.id !== deps.ownerId) return error(403, 'forbidden');
	if (session.kind === 'native' && session.resource !== 'projects') return error(403, 'forbidden');
	if (!deps.gateway) return error(503, 'drafts-unavailable');
	const { method } = request;
	if (method !== 'GET' && method !== 'POST') return error(405, 'method-not-allowed');
	const body = method === 'POST' ? await boundedBody(request) : '';
	if (body instanceof Response) return body;
	try {
		const result = await forwardOutgoingDraft(method, body, deps.gateway, deps);
		if (!admittedStatus.has(result.status)) {
			await result.body?.cancel();
			return error(503, 'drafts-unavailable');
		}
		return Response.json(await result.json(), { status: result.status, headers });
	} catch {
		return error(503, 'drafts-unavailable');
	}
}

async function boundedBody(request: Request) {
	try {
		return await readOverviewText(request, 96 * 1024);
	} catch (cause) {
		const response = hubHttpFailure(cause);
		response.headers.set('Cache-Control', headers['Cache-Control']);
		return response;
	}
}
