// @harness-uid u_nves237tvx
import type { TrackerMachineRunRef } from '../../../../../../src/utils/projects-sessions/trackerMachine.types';
import type { HomeComputerResources } from '../hub-home/homeLive.types';
import type { MachineStatus, OverviewItem } from './projectOverview.types';

/** Item statuses the tracker reports, including ignored records that never affect a card. */
import type { TrackerAttachment } from '../../../../../../src/utils/projects-sessions/trackerAttachment.types';
import type {
	TrackerPlanning,
	TrackerStage
} from '../../../../../../src/utils/projects-sessions/trackerPlanning.types';

export type TrackerItemStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'ignored';

/** A tracker note; only its time and text are read. */
export type TrackerNote = { at: string; text: string };

/** The fields of a tracker item that the overview reads. Other fields are never kept. */
export type TrackerItemRecord = {
	id: string;
	title: string;
	status: TrackerItemStatus;
	updated_at: string;
	due?: string | null;
	agent?: string | null;
	project?: string | null;
	sensitive?: boolean;
	deleted?: boolean;
	blocked_reason?: string | null;
	needs_daniel?: boolean;
	resolved?: boolean;
	question?: string | null;
	options?: { label: string; effect: string; recommended?: true }[];
	confirm?: 'deploy' | 'money' | 'secret';
	askedAt?: string | null;
	attachments?: TrackerAttachment[];
	notes_log?: TrackerNote[];
	kind?: string | null;
	parent?: string | null;
	computer?: string | null;
	model?: string | null;
	occurrence?: string | null;
	/** When the item next reminds, and the schedule it repeats on. */
	remindAt?: string | null;
	every?: string | null;
	recurring?: boolean;
	scheduleOff?: boolean;
	priority?: string | null;
	/** A launch has been requested and not cancelled. */
	launchRequested?: boolean;
	launchToken?: string | null;
	owner?: string | null;
	answer?: string | null;
	answeredAt?: string | null;
	/** The planning stage Tracker records: idea, detail, design or build. */
	stage?: TrackerStage | null;
	planning?: TrackerPlanning;
};

/** An item that may appear on a card: not deleted, sensitive or ignored, and named by its agent. */
export type IncludedTrackerItem = TrackerItemRecord & {
	agent: string;
	status: OverviewItem['status'];
};

export type TrackerRunDetailValue = string | number | boolean | object | null | undefined;

/** The run fields Home reads, as the Tracker sends them, before they are checked. */
export type TrackerRunDetailInput = Partial<
	Record<
		'queued_at' | 'started_at' | 'outcome' | 'model' | 'effort' | 'auto_token' | 'failure_reason',
		TrackerRunDetailValue
	>
>;

/** A run from GET /runs. The item's agent, not the run's project, names the card. */
export type TrackerRunRecord = {
	id: number;
	node?: string | null;
	item_id: string;
	state: string;
	ended_at: number | null;
	queued_at?: number | null;
	auto_token?: string | null;
	failure_reason?: string | null;
	started_at?: number | null;
	outcome?: string | null;
	model?: string | null;
	effort?: string | null;
};

/** A computer from /machines or /status.machines. Only safe resource attribution counts are included. */
export type TrackerMachineRecord = {
	node: string;
	status: MachineStatus;
	remoteRuns?: number;
	remoteRunRefs?: TrackerMachineRunRef[];
	resources?: HomeComputerResources;
};

/** Validated item, run, and machine records from the tracker. */
export type TrackerSources = {
	items: TrackerItemRecord[];
	runs: TrackerRunRecord[];
	machines: TrackerMachineRecord[];
};
