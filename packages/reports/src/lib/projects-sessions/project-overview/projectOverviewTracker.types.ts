// @harness-uid u_nves237tvx
import type { MachineStatus, OverviewItem } from './projectOverview.types';

/** Item statuses the tracker reports, including ignored records that never affect a card. */
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
	sensitive?: boolean;
	deleted?: boolean;
	blocked_reason?: string | null;
	needs_daniel?: boolean;
	resolved?: boolean;
	question?: string | null;
	options?: { label: string; effect: string; recommended?: true }[];
	confirm?: 'deploy' | 'money' | 'secret';
	notes_log?: TrackerNote[];
	kind?: string | null;
	parent?: string | null;
	computer?: string | null;
	model?: string | null;
	occurrence?: string | null;
	recurring?: boolean;
	scheduleOff?: boolean;
	answer?: string | null;
	answeredAt?: string | null;
};

/** An item that may appear on a card: not deleted, sensitive or ignored, and named by its agent. */
export type IncludedTrackerItem = TrackerItemRecord & {
	agent: string;
	status: OverviewItem['status'];
};

/** A run from GET /runs. The item's agent, not the run's project, names the card. */
export type TrackerRunRecord = {
	id: number;
	node?: string | null;
	item_id: string;
	state: string;
	ended_at: number | null;
};

/** A computer from /machines or /status.machines. Session and process counts are omitted. */
export type TrackerMachineRecord = { node: string; status: MachineStatus };

/** Validated item, run, and machine records from the tracker. */
export type TrackerSources = {
	items: TrackerItemRecord[];
	runs: TrackerRunRecord[];
	machines: TrackerMachineRecord[];
};
