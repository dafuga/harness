import type { Guard } from './browserEvidenceReads.types';
import { evidencePayload } from '../../../utils/verification-evidence/evidencePayload';
import { browserArtifact } from './browserArtifact';
import type { EntityEvidenceResult } from '../../../models/verification-evidence/DesktopEvidence.types';
import type { DesktopBridge } from '../../../models/development-tooling/DesktopBridge.types';
import type { BrowserApi } from '../../../models/development-tooling/BrowserApi.types';

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
