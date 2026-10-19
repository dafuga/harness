import { evidencePayload } from '$desktop/utils/evidencePayload';
import { browserArtifact } from './browserArtifact';
import type { EntityEvidenceResult } from '$desktop/models/DesktopEvidence.types';
import type { DesktopBridge } from '$desktop/models/DesktopBridge.types';
import type { ProjectContext } from '$desktop/models/ProjectContext.types';
import type { BrowserApi } from './browserApi';

type Guard = <T>(context: ProjectContext, read: (base: string) => Promise<T>) => Promise<T>;

/** Browser evidence uses the same permission guard as every other project read. */
export function browserEvidenceReads(
	api: BrowserApi,
	guard: Guard
): Pick<DesktopBridge, 'evidence' | 'artifact'> {
	return {
		evidence: (input) =>
			guard(input, (path) =>
				api.get<EntityEvidenceResult>(
					`${path}/evidence`,
					evidencePayload('evidence:read', { ...input })
				)
			),
		artifact: (input) =>
			guard(input, async (path) => {
				const media = await api.media(
					`${path}/artifact`,
					evidencePayload('evidence:artifact', { ...input })
				);
				return browserArtifact(media, input.sha256);
			})
	};
}
