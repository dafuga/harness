import type {
	EntityEvidenceQuery,
	EvidenceArtifactQuery
} from '../../../desktop/src/models/DesktopEvidence.types';
import { evidencePayload } from '../../../desktop/src/utils/evidencePayload';
import { hubFail } from './hubJson';

function fields(request: Request, projectId: string, channel: string) {
	const input: Record<string, unknown> = Object.fromEntries(new URL(request.url).searchParams);
	if (channel === 'evidence:artifact') {
		for (const key of ['viewport', 'notesRevision', 'evidenceRevision']) input[key] ??= null;
	}
	try {
		return { ...evidencePayload(channel, input), projectId };
	} catch {
		return hubFail('invalid-input');
	}
}

/** Public query fields are reconstructed; paths, URLs and supplied project IDs are dropped. */
export function hubEvidenceQuery(request: Request, projectId: string): EntityEvidenceQuery {
	return fields(request, projectId, 'evidence:read') as EntityEvidenceQuery;
}

export function hubArtifactQuery(request: Request, projectId: string): EvidenceArtifactQuery {
	return fields(request, projectId, 'evidence:artifact') as EvidenceArtifactQuery;
}
