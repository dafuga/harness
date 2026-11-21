// @harness-uid u_gs5pnxnxt4
import type { TrackerLadderConfig, TrackerModelRung } from './parseTrackerModelSpec.types';
import type { TrackerTaskKind } from './classifyTrackerTask.types';

export type TrackerModelHistory = Partial<Record<string, { ok: number; fail: number }>>;

export interface TrackerModelSelectionOptions {
	cfg?: TrackerLadderConfig;
	history?: TrackerModelHistory;
}

export interface TrackerModelSelection {
	rung: TrackerModelRung;
	kind: TrackerTaskKind;
	reason: string;
}

export interface TrackerRetryRun {
	rung: string;
	model: string;
	effort?: string | null;
	pinned?: boolean | number | null;
}
