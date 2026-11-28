// @harness-uid u_r7qgepnoax
import {
	outgoingDraftBodyLimit,
	outgoingDraftPath
} from '../../../services/projects-sessions/tracker-outgoing-draft-service/outgoingDraftAgentApi';
import { parseOutgoingDraft } from '../../../services/projects-sessions/tracker-outgoing-draft-service/outgoingDraftInput';
import type { NativeTrackerRequest } from './nativeTrackerCli.types';
import { readTrackerJsonFile } from './readTrackerJsonFile';

export function nativeTrackerDraftRequest([action, file, ...rest]: string[]): NativeTrackerRequest {
	if (action === 'list' && !file) return { method: 'GET', path: outgoingDraftPath };
	if (action === 'create' && file && !rest.length) {
		const draft = parseOutgoingDraft(readTrackerJsonFile(file, outgoingDraftBodyLimit, 'draft'));
		return { method: 'POST', path: outgoingDraftPath, body: draft };
	}
	throw new TypeError('usage: tracker draft create <json-file> | draft list');
}
