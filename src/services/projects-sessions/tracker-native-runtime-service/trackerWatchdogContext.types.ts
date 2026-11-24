// @harness-uid u_bl6xl2h4a3
import type { WatchdogCli, WatchdogPane } from '../WatchdogPaneService.types';

export interface TrackerContextSample {
	cwd: string;
	started: number;
	tokens: number;
	model?: string;
	effort?: string;
}

export type TrackerTranscriptRecord = Record<string, unknown>;

export type TrackerHandoffTarget = {
	pane: WatchdogPane;
	id: string;
	requested: number;
	runId?: number;
};

export type TrackerHandoffAttempt = {
	cli: WatchdogCli;
	token?: string;
	observed?: boolean;
	runId: number;
};
