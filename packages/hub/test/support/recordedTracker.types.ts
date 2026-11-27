export interface RecordedTrackerItem {
	id: string;
	title: string;
	status: string;
	stage: string | null;
	area_claim?: string;
	notes_log?: { at: string; text: string }[];
	agent: string | null;
	owner: string | null;
	computer: string | null;
	model: string | null;
	updated_at: string;
	created_at: string;
	due: string | null;
	auto: string | null;
	sensitive: boolean;
	deleted: boolean;
	blocked_reason?: string | null;
}

export interface RecordedTrackerRun {
	id: number;
	node: string;
	item_id: string;
	state: string;
	outcome: string | null;
	failure_reason?: string | null;
	model: string;
	effort: string | null;
	queued_at: number | null;
	started_at: number | null;
	ended_at: number | null;
}

export interface RecordedTracker {
	recordedAt: string;
	items: RecordedTrackerItem[];
	runs: RecordedTrackerRun[];
	machines: {
		node: string;
		status: string;
		remote_runs?: number;
		reasons?: string[];
		remote_run_refs?: { node: string; id: number }[];
		cores?: number;
		load?: number[];
		ram?: { total_mb: number; available_mb: number };
		disks?: { mount: string; free_gb: number }[];
	}[];
}
