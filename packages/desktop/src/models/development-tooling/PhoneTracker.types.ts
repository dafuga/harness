// @harness-uid u_uhyljnc37o
export type PhoneTrackerTool =
	| 'tracker_status'
	| 'tracker_show'
	| 'tracker_document'
	| 'tracker_search'
	| 'tracker_note'
	| 'tracker_flag'
	| 'tracker_answer'
	| 'tracker_done'
	| 'tracker_remind'
	| 'tracker_write_status'
	| 'tracker_discard_write';

export interface PhoneTrackerToolSchema {
	name: PhoneTrackerTool;
	description: string;
	inputSchema: Record<string, unknown>;
}

export interface PhoneTrackerResult {
	source: 'local_tracker';
	lastSyncedAt: string | null;
	freshness: 'current' | 'stale' | 'unavailable';
	partial: boolean;
	coverage?: { items: number; closedDays: number; notesPerItem: number; runsPerItem: number };
	code?: string;
	data?: unknown;
}

export interface PhoneTrackerTools {
	schemas: readonly PhoneTrackerToolSchema[];
	call(name: PhoneTrackerTool, input: Record<string, unknown>): Promise<PhoneTrackerResult>;
	refresh(): Promise<void>;
}
