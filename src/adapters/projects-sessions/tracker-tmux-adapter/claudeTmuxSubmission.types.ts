// @harness-uid u_fyf7e7kyi5
import type { TrackerTmuxPane } from '../TrackerTmuxAdapter.types';

export interface ClaudeSubmissionEffects {
	capture: () => Promise<TrackerTmuxPane | undefined>;
	enter: (draft: TrackerTmuxPane) => Promise<boolean>;
	working: (pane: TrackerTmuxPane['pane']) => boolean;
}

export interface ClaudeSubmissionProgress {
	enters: number;
	lastEnter: number;
	sawDraft: boolean;
}
