// @harness-uid u_bl6xl2h4a3
import type { TrackerSessionHealthIssue } from './trackerSessionHealth.types';

export interface TrackerSlotRun {
	id: number;
	itemId: string;
	endedAt: number;
	outcome: string | null;
	status: string | null;
	deleted: number | null;
}

export interface TrackerSlotHolder {
	run: number;
	item: string;
	state: string;
	session: string | null;
	why: string;
}

export interface TrackerLeftoverPane {
	run: number;
	item: string;
	session: string;
	why: string;
}

export interface TrackerSlotReport {
	computer: string;
	cap: number | null;
	held: TrackerSlotHolder[];
	/** Live panes of finished runs. They hold no launcher slot. */
	leftover: TrackerLeftoverPane[];
}

export interface TrackerSlotState {
	report: TrackerSlotReport;
	violations: TrackerSessionHealthIssue[];
}
