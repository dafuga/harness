import type { EntityEvidenceQuery } from '../../../../../models/verification-evidence/DesktopEvidence.types';

export type Query = EntityEvidenceQuery & { projectId: string };
