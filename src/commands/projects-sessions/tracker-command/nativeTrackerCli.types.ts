// @harness-uid u_r7qgepnoax
import type { TrackerListedRun } from '../../../repositories/projects-sessions/TrackerRunReadRepository.types';
import type { trackerRunReport } from '../../../utils/agents-providers/trackerRunReport';

export interface NativeTrackerRequest {
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
	path: string;
	body?: Readonly<Record<string, unknown>>;
}

export interface NativeTrackerItem {
	id: string;
	kind: string;
	title: string;
	status: string;
	blocked_reason?: string;
	ignored_reason?: string;
	ignored_until?: string;
	needs_daniel?: boolean;
	resolved?: boolean;
	every?: string;
	every_tz?: string;
	due?: string;
	owner?: string;
	agent?: string;
	auto?: string;
	last_result?: { occurrence: string; status: string; note?: string };
}

export interface NativeTrackerItemDetail extends NativeTrackerItem {
	parent?: string;
	question?: string;
	answer?: string;
	answered_by?: string;
	answered_at?: string;
	notes?: string;
	notes_log?: { at: string; node: string; text: string }[];
	callback?: { target: string; node: string };
	occurrence?: string;
	missed?: string;
	schedule_preview?: string | null;
	schedule_status?: string | null;
	schedule_off?: boolean;
	project?: string;
	repo?: string;
	computer?: string;
	launch_target?: string;
	model?: string;
	sensitive?: boolean;
	launch_status?: { computer: string | null; reason: string };
	runs?: NativeTrackerListedRun[];
	created_at?: string;
	created_by?: string;
	updated_at?: string;
}

export interface NativeTrackerAdapter {
	id: string;
	agent: string;
	paused: boolean;
	runner?: string;
	last_error?: string;
}

export interface NativeTrackerBackupList {
	status: { note: string };
	files: { kind: string; name: string; size: number; mtime: string }[];
}

export type NativeTrackerInspection =
	| NativeTrackerItemDetail
	| NativeTrackerAdapter[]
	| NativeTrackerBackupList;

export interface NativeTrackerListedRun extends TrackerListedRun {
	session_name?: string | null;
	tmux?: string | null;
	failure_reason?: string | null;
}

export interface NativeTrackerRunReport {
	ladder: string[];
	rows: ReturnType<typeof trackerRunReport>;
}

export interface NativeTrackerPick {
	rung: string;
	model: string;
	effort?: string | null;
	cli: string;
	pinned: boolean;
	reason: string;
	computer?: string | null;
}

export type NativeTrackerRunRead =
	| NativeTrackerListedRun[]
	| NativeTrackerRunReport
	| NativeTrackerPick;
