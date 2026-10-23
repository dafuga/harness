import type { EvidenceArtifactQuery } from '../../models/verification-evidence/DesktopEvidence.types';
import type { HarnessCapture } from '../../../../reports/src/models/Harness.types';

/** What names one capture of an evidence answer; all of it has to be as the answer lists it. */
export type CaptureBinding = Pick<
	EvidenceArtifactQuery,
	'side' | 'recordId' | 'scenarioId' | 'state' | 'evidenceId' | 'viewport' | 'sha256'
>;

export interface ListedCapture {
	capture: HarnessCapture;
	/** The record whose sealed files hold the bytes: for an inherited result, its origin. */
	record: string;
	focused?: boolean;
}
