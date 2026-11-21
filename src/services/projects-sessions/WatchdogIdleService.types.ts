import type { WatchdogCli, WatchdogScan } from './WatchdogPaneService.types';

export interface IdleScan extends WatchdogScan {
	quotaHolds?: readonly WatchdogCli[];
}

export interface IdleDecision {
	id: string;
	pane: string;
	paneKey: string;
	runId: number | null;
	cli: WatchdogCli;
	action: 'nudge' | 'alert';
	idleMinutes: number;
	reason?: string;
}

export interface IdlePlan {
	actions: IdleDecision[];
	abandonRunIds: number[];
}
