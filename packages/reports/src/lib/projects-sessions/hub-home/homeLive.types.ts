// @harness-uid u_dpe5j4r3is
import type {
	OverviewItem,
	OverviewMachine,
	OverviewSnapshot
} from '../project-overview/projectOverview.types';
import type {
	IncludedTrackerItem,
	TrackerRunRecord
} from '../project-overview/projectOverviewTracker.types';
import type { HomeTaskBoard } from './homeTaskBoard.types';
import type { HomeAgent, HomePastDue, OwnerHomeSnapshot } from './hubHome.types';
import type { TrackerStage } from '../../../../../../src/utils/projects-sessions/trackerPlanning.types';

/**
 * What a piece of work is doing now. `running` and `offline` are live Tracker runs (the second on
 * a computer Tracker reports offline), `queued` waits to start, `blocked` awaits a resolution, and `finished` ended within the last day.
 */
export type HomeWorkState = 'running' | 'offline' | 'queued' | 'blocked' | 'finished';

/** One live run, or one task that is in motion without one. */
export interface HomeWorkRow {
	key: string;
	itemId: string;
	/** Local Tracker run number, when reported by the linked computer. */
	runId?: number;
	title: string;
	state: HomeWorkState;
	/** How the latest run ended, as Tracker records it. */
	outcome: string | null;
	status: OverviewItem['status'];
	/** The item's planning stage; null when this computer's Tracker reports none. */
	stage: TrackerStage | null;
	/** Where the work really is: why it is blocked, or the latest milestone its owner noted. */
	now: string | null;
	/** Present only on an open task waiting for automatic pickup. */
	launchHold?: { until: string | null };
	owner: string | null;
	computer: string | null;
	model: string | null;
	/** When the run started, or was queued. Null when there is no run. */
	startedAt: string | null;
	updatedAt: string;
}

export interface HomeWorkProject {
	agent: string;
	/** Live runs on computers that are not offline. */
	running: number;
	/** Total run and task rows before the response size limit. Absent on older Macs. */
	totalRows?: number;
	/** Blocked rows without a running job, before the response size limit. */
	blockedRows?: number;
	/** Queue and offline rows before the response limit, excluding finished jobs. */
	waitingRows?: number;
	counts: Record<OverviewItem['status'], number>;
	rows: HomeWorkRow[];
	/** The newest change to any of the project's items. */
	updatedAt: string;
}

/** The current resource sample reported by the computer. */
export interface HomeComputerResources {
	ramAvailableMB?: number;
	ramTotalMB?: number;
	cores?: number;
	loadOne?: number;
	diskFreeGB?: number;
}

export interface HomeComputerSession {
	key: string;
	title: string;
	origin: string | null;
}

/** Older linked apps and offline computers omit live details. */
export interface HomeComputer extends OverviewMachine {
	agentCount?: number;
	reasons?: string[];
	resources?: HomeComputerResources;
	sessions?: HomeComputerSession[];
}

/** Every project, session and run one computer's Tracker knows, read when it was asked. */
export interface HomeLiveOverview {
	readAt: string;
	projects: HomeWorkProject[];
	machines: HomeComputer[];
	/** Live runs of private or ignored items: counted, never described. */
	hiddenRuns: number;
	/** Distinct project and owner pairs with visible live runs, before project or row truncation. */
	runningAgentCount?: number;
	/** Rows left out because a project had more than the list holds. */
	omittedRows: number;
	/** The Kanban board. Older Mac apps send none. */
	board?: HomeTaskBoard;
}

/** One item with the runs that belong to it, and the computers Tracker reports offline. */
export interface ItemWork {
	item: IncludedTrackerItem;
	runs: TrackerRunRecord[];
	offline: ReadonlySet<string>;
	now: number;
}

export interface LinkedHome {
	/** Computers linked to the signed-in account, online or not. */
	linked: number;
	/** How many of them answered this read. */
	answered: number;
	snapshot: OwnerHomeSnapshot | null;
	/** The list of linked computers itself could not be read, so zero linked means unknown. */
	unlisted?: true;
}

export interface HomeWorkView {
	overview: OverviewSnapshot | null;
	work: (OverviewItem & { project: string })[];
	agents: HomeAgent[] | null;
	pastDue: HomePastDue[];
	trackerConnected: boolean;
	now: number;
}
