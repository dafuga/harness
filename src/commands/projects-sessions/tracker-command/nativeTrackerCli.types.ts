// @harness-uid u_r7qgepnoax
import type { TrackerItemMatch } from '../../../utils/projects-sessions/checkTrackerItem.types';
import type { TrackerNodeConfig } from '../../../services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import type { TrackerAdapterPollResult } from '../../../services/projects-sessions/TrackerAdapterPollService.types';
import type { TrackerListedRun } from '../../../repositories/projects-sessions/TrackerRunReadRepository.types';
import type {
	TrackerPlanning,
	TrackerStage
} from '../../../utils/projects-sessions/trackerPlanning.types';
import type { trackerRunReport } from '../../../utils/agents-providers/trackerRunReport';

/** The error body of a refused native request. */
export interface NativeTrackerRefusal {
	error?: string;
	code?: string;
	matches?: TrackerItemMatch[];
}

export type NativeTrackerListener = Pick<TrackerNodeConfig, 'apiPort' | 'node' | 'role'>;

export interface NativeTrackerRequest {
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
	path: string;
	body?: Readonly<Record<string, unknown>>;
}

/** The parsed command-line words of one `tracker` command, as `parseArgs` returns them. */
export type NativeTrackerAskValues = Record<string, string | string[] | boolean | undefined>;

export interface NativeTrackerItem {
	/** Set by reject: the auto-run charged with the rejected result. */
	rejected_run?: { id: number; rung: string } | null;
	id: string;
	kind: string;
	priority?: 'urgent' | 'normal' | 'low';
	title: string;
	status: string;
	stage?: TrackerStage;
	blocked_reason?: string;
	ignored_reason?: string;
	ignored_until?: string;
	needs_daniel?: boolean;
	resolved?: boolean;
	chased_count?: number;
	chased_at?: string;
	chased_by?: string | null;
	chased_reason?: string | null;
	every?: string;
	every_tz?: string;
	due?: string;
	remind_at?: string | null;
	next_step?: string;
	parked_until?: string;
	schedule_hold?: { reason: string; until: string | null };
	owner?: string;
	agent?: string;
	auto?: string;
	last_result?: { occurrence: string; status: string; note?: string };
}

export interface NativeTrackerItemDetail extends NativeTrackerItem {
	planning?: TrackerPlanning;
	parent?: string;
	question?: string;
	options?: { label: string; effect: string; recommended?: true }[];
	confirm?: string | null;
	answer_option?: number | null;
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

export interface NativeTrackerAlertReceipt {
	/** Null when the target is not a known item; the message is in the inbox all the same. */
	item_id: string | null;
	target: string;
}

export interface NativeTrackerAdapter {
	id: string;
	agent: string;
	paused: boolean;
	runner?: string;
	last_error?: string;
}

/** The reply to adapter add, pause, resume or remove. */
export interface NativeTrackerAdapterChange {
	id: string;
	enabled_at?: number;
	paused?: boolean;
	removed?: boolean;
}

export type NativeTrackerAdapterReply =
	| NativeTrackerAdapterChange
	| Extract<TrackerAdapterPollResult, { status: 'polled' }>;

export interface NativeTrackerBackupList {
	status:
		| { enabled: false; note: string }
		| {
				enabled: true;
				schedule: string;
				last_ok: string | null;
				last_error: string | null;
				stale: boolean;
		  };
	files: { kind: string; name: string; size: number; mtime: string }[];
}

export type NativeTrackerInspection =
	| NativeTrackerItemDetail
	| NativeTrackerAdapter[]
	| NativeTrackerBackupList;

export interface NativeTrackerListedRun extends TrackerListedRun {
	session_name?: string | null;
	session_id?: string | null;
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
