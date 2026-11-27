// @harness-uid u_jkomno4o5u
import type { TrackerOutgoingDraftService } from '../TrackerOutgoingDraftService';
import {
	outgoingDraftAgentApi,
	outgoingDraftBodyLimit
} from '../tracker-outgoing-draft-service/outgoingDraftAgentApi';
import { trackerHubResponse } from './hubHttp';

export function serveSyncedDraft(
	service: TrackerOutgoingDraftService,
	method: string,
	body: string,
	peer: string
): Response {
	if (Buffer.byteLength(body) > outgoingDraftBodyLimit)
		return trackerHubResponse(413, { error: 'body too large' });
	let input: unknown;
	try {
		input = method === 'POST' ? JSON.parse(body) : undefined;
	} catch {
		return trackerHubResponse(400, { error: 'invalid JSON body' });
	}
	return outgoingDraftAgentApi(service, method, input, peer);
}
