import type { WatchdogItem, WatchdogPane, WatchdogRun } from './WatchdogPaneService.types';

export interface RecoveryItem extends WatchdogItem {
	type: 'task' | 'plan' | 'goal';
	every?: string | null;
	scheduleOff?: boolean;
	autoToken?: string | null;
	/** Effective target (launch_target or computer), before host alias normalization. */
	target?: string | null;
	nonWorkReason?: string | null;
	statusAt?: number;
	/** Remaining session aliases from the item owner and the launcher label. */
	sessionAliases?: readonly string[];
}

export interface PeerWatchdogSample {
	node: string;
	sampledAt: number;
	sessionKeys?: readonly string[];
	offline?: boolean;
	managedPaneActivity?: readonly (readonly [sessionKey: string, activity: number])[];
}

export interface RecoverySnapshot {
	host: string;
	node?: string;
	now: number;
	item: RecoveryItem;
	/** Full non-deleted item ID set, including closed items, for manual-prefix resolution. */
	items: readonly WatchdogItem[];
	panes: readonly WatchdogPane[] | null;
	localRuns: readonly WatchdogRun[];
	/** Merged local and remote run history with the latest queued run last. */
	history: readonly (WatchdogRun & { node: string })[];
	localSessionNames?: readonly string[];
	peers?: readonly PeerWatchdogSample[];
	activeRemoteRun?: boolean;
	tokenStarted?: boolean;
	launcherEnabled: boolean;
	localHold?: string | null;
	scheduledHold?: string | null;
	repoExists: boolean;
	lastRestartAt?: number;
	targeted?: boolean;
}

export interface RecoveryDecision {
	id: string;
	computer: string | null;
	action:
		| 'other_host'
		| 'unassigned'
		| 'opted_out'
		| 'live'
		| 'grace'
		| 'refused'
		| 'queued'
		| 'cooldown'
		| 'relaunch';
	reason?: string;
	stoppedPanes?: string[];
}

export interface AnsweredItem extends WatchdogItem {
	answeredAt?: string | null;
	blockedReason?: string | null;
	/** Tracker's fixed-width hybrid clocks for the current values. */
	clocks: { answer?: string; question?: string; status?: string; blockedReason?: string };
}

export interface ResumeSnapshot {
	item: AnsweredItem;
	run: WatchdogRun;
	localRuns: readonly WatchdogRun[];
	panes: readonly WatchdogPane[] | null;
	exitCode: number | null;
	now: number;
}

export interface ResumeDecision {
	runId: number;
	reopenItem: boolean;
	resumedAt: number;
}
