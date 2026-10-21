import type { Verification } from '../../models/development-tooling/Desktop.types';
import type { EntityEvidenceResult } from '../../models/verification-evidence/DesktopEvidence.types';
import { type EvidenceStatus } from '../verification-evidence/evidenceNotice';

/** What of the evidence store says how far the read of an entity has come. */
export interface EvidenceRead {
	status: EvidenceStatus;
	result: EntityEvidenceResult | null;
	error: string;
}

export interface EntityVerdict {
	status: Verification;
	reason: string;
}

export { evidenceVerdict } from '../../components/explorer-ui/entity-view/evidenceVerdict';
