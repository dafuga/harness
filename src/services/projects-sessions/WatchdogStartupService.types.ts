// @harness-uid u_yz3ar5ts6w
import type {
	StartupPromptKind,
	WatchdogItem,
	WatchdogRun,
	WatchdogScan
} from './WatchdogPaneService.types';

export interface StartupTrustEvidence {
	/** The launch workspace's verified real path. */
	canonicalRepo: string;
	/** Origin and Git common-directory ownership were verified for this run. */
	ownedBySourceRepo: boolean;
	alreadyAttempted: boolean;
}

export interface StartupAlert {
	id: string;
	reason: string;
	identity: string;
}

export interface StartupScan extends WatchdogScan {
	previousAlerts?: readonly StartupAlert[];
	trustByRun?: ReadonlyMap<number, StartupTrustEvidence>;
}

export type StartupDecision =
	| {
			id: string;
			pane: string;
			paneKey: string;
			runId: number;
			kind: 'folder trust';
			action: 'trust';
	  }
	| {
			id: string;
			pane: string;
			paneKey: string;
			kind: StartupPromptKind;
			action: 'alert';
			reason: string;
			identity: string;
			writeAlert: boolean;
			question: string | null;
	  };

export interface StartupPlan {
	actions: StartupDecision[];
	clearAlerts: { id: string; clearQuestion: boolean }[];
}

export interface StartupCandidates {
	items: ReadonlyMap<string, WatchdogItem>;
	running: ReadonlyMap<string | null | undefined, WatchdogRun>;
	previous: ReadonlyMap<string, StartupAlert>;
	pending: Set<string>;
	actions: Map<string, StartupDecision>;
}
