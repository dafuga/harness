// @harness-uid u_4usb4rrlje
import { z } from 'zod';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import type { TrackerSyncAuthService } from '../../networking-security/TrackerSyncAuthService';
import type { TrackerHubRequest } from '../TrackerHubSyncService.types';
import type { TrackerOutgoingDraftService } from '../TrackerOutgoingDraftService';
import { trackerFailureResponse } from '../tracker-local-api-service/trackerLocalResponse';

export const outgoingDraftOwnerPath = '/sync/owner/outgoing-drafts';

const owner = { kind: 'owner' as const, by: 'Daniel' };
const revision = { id: z.uuid(), revision: z.int().positive() };
const action = z.discriminatedUnion('action', [
	z.strictObject({
		...revision,
		action: z.literal('edit'),
		message: z.record(z.string(), z.unknown())
	}),
	z.strictObject({ ...revision, action: z.literal('discard') }),
	z.strictObject({ ...revision, action: z.literal('send') })
]);

/** The owner grant is distinct from the fleet key and works only for this exact owner route. */
export async function outgoingDraftOwnerApi(
	{ service, auth }: { service: TrackerOutgoingDraftService; auth: TrackerSyncAuthService },
	request: TrackerHubRequest,
	body: string,
	now: number
): Promise<Response> {
	const headers = { 'cache-control': 'private, no-store' };
	const { method, pathAndQuery } = request;
	if (
		pathAndQuery !== outgoingDraftOwnerPath ||
		!auth.verify(
			{ method, pathAndQuery, body },
			request.headers.get('authorization') ?? undefined,
			now
		)
	)
		return Response.json({ error: 'owner approval required' }, { status: 403, headers });
	try {
		if (method === 'GET') return Response.json(service.reviewQueue(), { headers });
		if (method !== 'POST')
			return Response.json({ error: 'method not allowed' }, { status: 405, headers });
		request.signal?.throwIfAborted();
		return Response.json(await applyOwnerAction(service, parseAction(body)), { headers });
	} catch (error) {
		const response = trackerFailureResponse(error);
		response.headers.set('cache-control', 'private, no-store');
		return response;
	}
}

function applyOwnerAction(service: TrackerOutgoingDraftService, input: z.infer<typeof action>) {
	const version = { id: input.id, revision: input.revision };
	switch (input.action) {
		case 'edit':
			return service.edit(version, input.message, owner);
		case 'discard':
			return service.discard(version, owner);
		case 'send':
			return service.send(version, owner);
		default:
			throw trackerItemError('invalid draft action');
	}
}

function parseAction(body: string) {
	try {
		const parsed = action.safeParse(JSON.parse(body));
		if (parsed.success) return parsed.data;
	} catch {
		// Report malformed JSON without including draft text.
	}
	throw trackerItemError('invalid draft action');
}
