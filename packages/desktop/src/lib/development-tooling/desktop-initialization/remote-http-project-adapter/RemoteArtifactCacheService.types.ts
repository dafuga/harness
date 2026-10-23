import type { EvidenceArtifactQuery } from '../../../../models/verification-evidence/DesktopEvidence.types';

export type Query = EvidenceArtifactQuery & { projectId: string };

export type Media = { bytes: Uint8Array; mediaType: string; principalId: string };
