import type { Actor } from 'collaboration';
import type { HubProjectionService } from '../services/HubProjectionService';
import { hubArtifactQuery, hubEvidenceQuery } from './hubEvidenceQuery';
import { hubHttp } from './hubHttp';

interface EvidenceRead {
	actor: Actor;
	projectId: string;
	request: Request;
	projection: HubProjectionService;
}

/** Reads share the authenticated project service; returned media has an attested type. */
export async function hubEvidenceRead(context: EvidenceRead, operation: string): Promise<Response> {
	const { actor, projectId, request, projection } = context;
	if (request.method !== 'GET') return hubHttp({ error: 'method-denied' }, 405);
	if (operation === 'evidence')
		return hubHttp(
			await projection.evidence(actor, projectId, hubEvidenceQuery(request, projectId))
		);
	const artifact = await projection.artifact(
		actor,
		projectId,
		hubArtifactQuery(request, projectId)
	);
	return new Response(new Uint8Array(artifact.bytes), {
		headers: {
			'Content-Type': artifact.mediaType,
			'Cache-Control': 'no-store',
			'X-Content-Type-Options': 'nosniff'
		}
	});
}
