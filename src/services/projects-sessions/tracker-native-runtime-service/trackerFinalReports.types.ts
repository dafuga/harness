// @harness-uid u_bl6xl2h4a3
import type { WatchdogPane, WatchdogRun } from '../WatchdogPaneService.types';

export interface TrackerReportSession {
	pane: WatchdogPane;
	run: WatchdogRun;
	host: string;
}

export interface TrackerFinalReport {
	outcome: 'blocked' | 'abandoned';
	reason: string;
}
