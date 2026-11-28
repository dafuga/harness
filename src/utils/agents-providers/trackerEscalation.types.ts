// @harness-uid u_gs5pnxnxt4
import type { TrackerModelRung } from './parseTrackerModelSpec.types';

export interface TrackerModelFailure {
	model: string;
	effort: string | null;
}

/** What has already gone wrong on one item. */
export interface TrackerModelEvidence {
	failed: readonly TrackerModelFailure[];
	/** Models named by the item's model-quality incident notes. */
	incidents: readonly string[];
}

/** The launch route a Gemini CLI must provide before escalation can use it. */
export type TrackerGeminiAdapter = (model?: string) => TrackerModelRung;
