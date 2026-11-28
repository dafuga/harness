// @harness-uid u_gs5pnxnxt4
import type { TrackerTaskRoute, TrackerTaskSize } from './classifyTrackerTask.types';
import type { TrackerLadderConfig, TrackerModelRung } from './parseTrackerModelSpec.types';
import type { TrackerTaskKind } from './classifyTrackerTask.types';

export type TrackerModelHistory = Partial<Record<string, { ok: number; fail: number }>>;

export interface TrackerModelSelectionOptions {
	cfg?: TrackerLadderConfig;
	history?: TrackerModelHistory;
	/** Epoch milliseconds that select the routing table; defaults to the current time. */
	now?: number;
	/** The operator's Claude preference: automatic and Codex choices go to Claude before this. */
	claudePreferredUntil?: string;
}

export type TrackerRetryOptions = Omit<TrackerModelSelectionOptions, 'history'>;

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

export interface ClaudeRoute {
	steps: TrackerModelRung[];
	why: string;
}

export interface PinContext {
	route: TrackerTaskRoute;
	restrictions: string[];
	claude: boolean;
}

export type SelectionContext = PinContext & {
	kind: TrackerTaskKind;
	size: TrackerTaskSize;
	preferred?: string;
};

export interface PreferredSelectionContext {
	kind: TrackerTaskKind;
	size: TrackerTaskSize;
	restrictions: string[];
	preferred: string;
}
