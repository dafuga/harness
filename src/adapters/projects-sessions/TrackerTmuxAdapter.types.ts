// @harness-uid u_fyf7e7kyi5
import type {
	WatchdogCli,
	WatchdogPane
} from '../../services/projects-sessions/WatchdogPaneService.types';

export interface TrackerTmuxAdapterConfig {
	executable: string;
	node: string;
}

export interface TrackerTmuxPane {
	pane: WatchdogPane;
	id: string;
	raw: string;
	socket: string;
}

export interface TrackerTmuxNudge {
	pane: Pick<WatchdogPane, 'key' | 'name' | 'activity' | 'createdAt' | 'x' | 'y'>;
	cli: WatchdogCli;
	message: string;
	/** Which sessions may match; defaults to Chief of Staff or Tracker worker names. */
	names?: RegExp;
}

export interface TrackerTmuxClose {
	pane: TrackerTmuxNudge['pane'];
	cli: WatchdogCli;
	attempt?: string;
	observed?: boolean;
	/** Close even without an empty composer: the pane has been silent since its run ended. */
	force?: boolean;
	/** Leave a session whose provider still reports a background shell or monitor. */
	keepBackground?: boolean;
	stillComplete(): boolean;
}
