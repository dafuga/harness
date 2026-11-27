// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerListedRun } from '../../../repositories/projects-sessions/TrackerRunReadRepository.types';
import type {
	TrackerDispatchResult,
	TrackerLaunchRung
} from '../../agents-providers/TrackerDispatcherService.types';
import type { WatchdogPane } from '../WatchdogPaneService.types';

export interface TrackerSessionHealthIssue {
	item_id: string;
	host: string;
	session: string | null;
	kind: 'missing' | 'launch-stuck' | 'orphan' | 'finished' | 'finished-run-pane' | 'idle-run';
	reason: string;
	identity: string;
	recover?: boolean;
	blockReason?: string;
}

export interface TrackerSessionHealthSnapshot {
	host: string;
	now: number;
	reportUnassigned?: boolean;
	items: readonly TrackerItem[];
	panes: readonly WatchdogPane[];
	runs: (id: string) => readonly TrackerListedRun[];
	scheduleAt: (id: string) => number;
	linkedItems: (runId: number) => readonly string[];
	/** Panes whose finished run is judged by the run's own slot rule instead of its item. */
	judgedByRun?: ReadonlySet<string>;
}

export type TrackerWatchdogLaunch = (
	item: TrackerItem,
	attempt?: { token: string; rung?: TrackerLaunchRung }
) => Promise<TrackerDispatchResult>;
