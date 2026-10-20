import type { Verification } from '../models/Desktop.types';
import type { EntityEvidenceResult } from '../models/DesktopEvidence.types';
import { type EvidenceStatus } from './evidenceNotice';

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

export { evidenceVerdict } from '../components/entity-view/evidenceVerdict';
