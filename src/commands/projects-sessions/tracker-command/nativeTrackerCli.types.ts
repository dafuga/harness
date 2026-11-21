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
	last_result?: { occurrence: string; status: string };
}

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
