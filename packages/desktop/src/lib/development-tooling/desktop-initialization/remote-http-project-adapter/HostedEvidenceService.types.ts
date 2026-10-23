import type { EntityEvidenceQuery } from '../../../../models/verification-evidence/DesktopEvidence.types';
import type { EvidenceArtifactQuery } from '../../../../models/verification-evidence/DesktopEvidence.types';

export type Asked = EntityEvidenceQuery & { projectId: string };

export interface Transport {
	path(operation: 'evidence' | 'artifact', query: Asked): string;
	evidence(query: Asked): Promise<unknown>;
	artifact(
		query: EvidenceArtifactQuery & { projectId: string }
	): Promise<{ bytes: Uint8Array; mediaType: string; principalId: string }>;
}
