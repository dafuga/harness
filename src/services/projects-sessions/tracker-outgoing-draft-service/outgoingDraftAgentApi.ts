// @harness-uid u_4usb4rrlje
import type { TrackerOutgoingDraft } from '../../../repositories/projects-sessions/TrackerOutgoingDraftRepository.types';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import type { TrackerOutgoingDraftService } from '../TrackerOutgoingDraftService';
import { trackerFailureResponse } from '../tracker-local-api-service/trackerLocalResponse';

export const outgoingDraftPath = '/outgoing-drafts';
export const outgoingDraftSyncPath = '/sync' + outgoingDraftPath;
export const outgoingDraftBodyLimit = 96 * 1024;

/** Fleet callers get creation and readback of their own receipts. No fleet route sends a message. */
export function outgoingDraftAgentApi(
	service: TrackerOutgoingDraftService,
	method: string,
	payload: unknown,
	peer: string
): Response {
	try {
		if (!/^[a-zA-Z0-9._-]{1,100}$/.test(peer)) throw trackerItemError('invalid draft source', 403);
		const actor = { kind: 'agent' as const, by: peer };
		const headers = { 'cache-control': 'private, no-store' };
		if (method === 'GET') return Response.json(service.list(actor).map(summary), { headers });
		if (method === 'POST')
			return Response.json(summary(service.create(payload, actor)), { status: 201, headers });
		return Response.json({ error: 'method not allowed' }, { status: 405, headers });
	} catch (error) {
		return trackerFailureResponse(error);
	}
}

function summary({ id, itemId, message, status, delivery, revision }: TrackerOutgoingDraft) {
	return { id, itemId, channel: message.channel, status, delivery, revision };
}
