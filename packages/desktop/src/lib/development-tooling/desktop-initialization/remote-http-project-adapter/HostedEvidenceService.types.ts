// @harness-uid u_vvwiludcl4
import type {
	EntityEvidenceQuery,
	EvidenceArtifactQuery
} from '../../../../models/verification-evidence/DesktopEvidence.types';

export type HostedEntityEvidenceQuery = EntityEvidenceQuery & { projectId: string };

export interface Transport {
	path(operation: 'evidence' | 'artifact', query: HostedEntityEvidenceQuery): string;
	evidence(query: HostedEntityEvidenceQuery): Promise<unknown>;
	artifact(
		query: EvidenceArtifactQuery & { projectId: string }
	): Promise<{ bytes: Uint8Array; mediaType: string; principalId: string }>;
}
