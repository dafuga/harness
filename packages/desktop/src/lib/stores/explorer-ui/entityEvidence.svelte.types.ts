// @harness-uid u_bohfxf5fxx
import type { EntityEvidenceQuery } from '../../../models/verification-evidence/DesktopEvidence.types';
import type { createEntityEvidenceStore } from './entityEvidence.svelte';

export class EvidenceCaptureUnavailableError extends Error {
	override name = 'EvidenceCaptureUnavailableError';
}

/** What decides which evidence is shown; `stamp` names the pinned revisions of the project. */
export interface EvidenceTarget {
	scope: EntityEvidenceQuery | null;
	planned: boolean;
	stamp: string;
}

export type EntityEvidence = ReturnType<typeof createEntityEvidenceStore>;
