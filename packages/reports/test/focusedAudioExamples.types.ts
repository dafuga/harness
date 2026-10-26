import type { HarnessRevision, HarnessUnit } from '../src/models/Harness.types';

export interface FocusedAudioFixture {
	unit: HarnessUnit;
	detail: HarnessRevision;
}

export type FocusedAudioProvenance = 'fixture' | 'actual-capture';

export interface FocusedAudioSlot {
	evidence: string;
	caseId: string;
	provenance?: FocusedAudioProvenance;
}

type Regression = NonNullable<NonNullable<HarnessRevision['regressions']>[number]>;
type RegressionCapture = NonNullable<NonNullable<Regression['green']>['captures']>[number];

/** Raw sealed-audio regression capture; its note binds it to one case and revision. */
export interface FocusedAudioRawCapture {
	unit: string;
	capture: RegressionCapture['capture'] & { note: string };
}
