import type { focusedScreens } from '../../src/workflows/verification-evidence/record-regression/focusedScreens';
import type { RegressionNote } from '../../src/utils/git-source-history/regressionHistory.types';

export type RetainedAudio = Awaited<ReturnType<typeof focusedScreens>>;

export interface SealedAudioFixture {
	note: RegressionNote;
	files: Map<string, Buffer>;
}
