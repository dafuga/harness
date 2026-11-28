// @harness-uid u_gs5pnxnxt4
import type { TrackerTaskRoute, TrackerTaskSize } from './classifyTrackerTask.types';
import type { TrackerLadderConfig, TrackerModelRung } from './parseTrackerModelSpec.types';
import type { TrackerTaskKind, TrackerTaskType } from './classifyTrackerTask.types';
import type { TrackerModelEvidence } from './trackerEscalation.types';

export type TrackerModelHistory = Partial<Record<string, { ok: number; fail: number }>>;

export interface TrackerModelSelectionOptions {
	cfg?: TrackerLadderConfig;
	history?: TrackerModelHistory;
	/** Epoch milliseconds that select the routing table; defaults to the current time. */
	now?: number;
	/** The operator's Claude preference: automatic and Codex choices go to Claude before this. */
	claudePreferredUntil?: string;
	/** Failed attempts and quality incidents on this item; they climb and escalate the route. */
	evidence?: TrackerModelEvidence;
}

export type TrackerRetryOptions = Omit<TrackerModelSelectionOptions, 'history'>;

export interface TrackerModelSelection {
	rung: TrackerModelRung;
	kind: TrackerTaskKind;
	reason: string;
	taskType: TrackerTaskType;
}

export interface TrackerRetryRun {
	rung: string;
	model: string;
	effort?: string | null;
	pinned?: boolean | number | null;
}

export interface TrackerRouteContext {
	cfg?: TrackerLadderConfig;
	claudeOnly?: boolean;
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
	cfg?: TrackerLadderConfig;
};
