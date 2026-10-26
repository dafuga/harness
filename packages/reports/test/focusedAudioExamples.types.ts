import type { HarnessRevision, HarnessUnit } from '../src/models/Harness.types';

export interface FocusedAudioFixture {
	unit: HarnessUnit;
	detail: HarnessRevision;
}

export interface FocusedAudioSlot {
	evidence: string;
	caseId: string;
}
