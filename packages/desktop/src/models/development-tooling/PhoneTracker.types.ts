// @harness-uid u_uhyljnc37o
export type PhoneTrackerTool = 'tracker_status' | 'tracker_show' | 'tracker_search';

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
	code?: string;
	data?: unknown;
}

export interface PhoneTrackerTools {
	schemas: readonly PhoneTrackerToolSchema[];
	call(name: PhoneTrackerTool, input: Record<string, unknown>): Promise<PhoneTrackerResult>;
	refresh(): Promise<void>;
}
