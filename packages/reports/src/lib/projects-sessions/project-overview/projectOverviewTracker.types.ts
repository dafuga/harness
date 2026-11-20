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
	notes_log?: TrackerNote[];
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
};

/** A computer from GET /machines. Its session and process counts are not read. */
export type TrackerMachineRecord = { node: string; status: MachineStatus };

/** Validated responses of the three fixed tracker reads. */
export type TrackerSources = {
	items: TrackerItemRecord[];
	runs: TrackerRunRecord[];
	machines: TrackerMachineRecord[];
};
