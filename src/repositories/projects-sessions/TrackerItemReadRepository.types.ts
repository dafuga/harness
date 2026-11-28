// @harness-uid u_xba7ieg4je
import type { TrackerAttachment } from '../../utils/projects-sessions/trackerAttachment.types';
import type { TrackerItemPriority } from '../../utils/projects-sessions/normalizeTrackerItemFields.types';
import type { TrackerAskOption } from '../../utils/projects-sessions/trackerAskOptions.types';
import type { trackerItemFields } from '../../adapters/projects-sessions/TrackerSchemaAdapter';

import type {
	TrackerPlanning,
	TrackerStage
} from '../../utils/projects-sessions/trackerPlanning.types';

type LegacySchedule = 'schedule_hold_reason';

type ItemFlags = 'needs_daniel' | 'resolved' | 'deleted';

export type TrackerItemRow = Omit<
	Record<(typeof trackerItemFields)[number], string | null>,
	ItemFlags | LegacySchedule
> &
	Partial<Record<LegacySchedule, string | null>> &
	Record<ItemFlags, number> & {
		legacy_adapter_manual?: number | null;
		id: string;
		updated_at: string | null;
		clocks: string;
		chased_clock?: string | null;
		chased_by?: string | null;
		chased_reason?: string | null;
		chased_count?: number | null;
	};

type TrackerChase = {
	chased_at?: string;
	chased_by?: string | null;
	chased_reason?: string | null;
	chased_count?: number;
};

export type TrackerItemListFilters = {
	status?: string;
	stage?: string;
	kind?: string;
	owner?: string;
	agent?: string;
	parent?: string;
	flagged?: boolean | string;
	chased?: boolean | string;
	recurring?: boolean | string;
	limit?: number | string;
};

export type TrackerItemNote = { at: string; node: string | null; text: string };

type TrackerItemDetailFields =
	| 'id'
	| 'kind'
	| 'title'
	| 'status'
	| 'due'
	| 'remind_at'
	| 'owner'
	| 'agent'
	| 'parent'
	| 'notes'
	| 'question'
	| 'answer'
	| 'answered_at'
	| 'answered_by'
	| 'created_at'
	| 'created_by'
	| 'updated_at';

type TrackerNextStep = { next_step?: string; parked_until?: string };

export type TrackerItem = Pick<TrackerItemRow, TrackerItemDetailFields> & {
	priority: TrackerItemPriority;
} & TrackerNextStep &
	TrackerChase & {
		stage: TrackerStage;
		planning: TrackerPlanning;
		blocked_reason: string | null;
		ignored_reason?: string | null;
		ignored_by?: string | null;
		ignored_at?: string | null;
		ignored_until?: string | null;
		auto: string | null;
		project: string | null;
		repo: string | null;
		computer: string | null;
		launch_target: string | null;
		launch_source: string | null;
		launch_pick: string | null;
		schedule_off: boolean;
		schedule_hold?: { reason: string; until: string | null };
		schedule_status: string | null;
		model: string | null;
		sensitive: boolean;
		recurring: boolean;
		every: string | null;
		every_tz: string | null;
		occurrence: string | null;
		last_result: unknown;
		missed: string | null;
		adapter_instructions?: string;
		notes_log: TrackerItemNote[];
		/** When the open ask with choices was raised. */
		asked_at?: string;
		options?: TrackerAskOption[];
		confirm?: string;
		/** Documents of the ask; their text is read one at a time. */
		attachments?: TrackerAttachment[];
		answer_option?: number;
		needs_daniel: boolean;
		resolved: boolean;
		callback: { target: string; node?: unknown } | null;
		deleted: boolean;
	};

export type TrackerDigestItem = Pick<
	TrackerItem,
	| 'id'
	| 'kind'
	| 'title'
	| 'status'
	| 'stage'
	| 'priority'
	| 'blocked_reason'
	| 'needs_daniel'
	| 'due'
	| 'owner'
	| 'agent'
	| 'question'
	| 'created_by'
	| 'updated_at'
> &
	TrackerChase &
	Partial<Pick<TrackerItem, 'options' | 'confirm'>> &
	TrackerNextStep & {
		project?: string;
		remind_at?: string;
		asked_at?: string;
		waiting_minutes?: number;
	};

export type TrackerRecurringProblem = TrackerDigestItem & {
	every: string;
	every_tz: string;
	missed: string | null;
	missed_local: string | null;
	failed: { occurrence: string; note: string | null } | null;
	failed_local: string | null;
};

export type TrackerDigestGroups = {
	blocked: TrackerDigestItem[];
	needs_daniel: TrackerDigestItem[];
	/** Open structured asks, the only decisions shown to Daniel, oldest first, including finished and blocked items. */
	daniel_decisions: TrackerDigestItem[];
	/** Open flags raised by watchdog and idle-session alerts for Chief of Staff, oldest first. */
	pings: TrackerDigestItem[];
	/** Other open flags without answerable choices, for Chief of Staff to rewrite or clear, oldest first. */
	needs_options: TrackerDigestItem[];
	overdue: TrackerDigestItem[];
	due_today: TrackerDigestItem[];
	recurring_missed: TrackerRecurringProblem[];
	chased_7d: TrackerDigestItem[];
	launch_holds: (TrackerDigestItem & { reason: string; until: string | null })[];
	queued: (TrackerDigestItem & {
		requested_at: string;
		waiting_minutes: number;
		computer: string | null;
	})[];
};

type TrackerStatusCounts = { in_progress: number; blocked: number; open: number };

export type TrackerProjectStatus = TrackerStatusCounts & {
	project: string;
	/** Phase 4 module workers already included in this project's counts. */
	phase4_workers: TrackerStatusCounts & { total: number };
	eta?: { id: string; due: string; overdue: boolean };
	latest_note?: { id: string; at: string; text: string };
};

export type TrackerDigest = TrackerDigestGroups & {
	projects: TrackerProjectStatus[];
	/** Every action only Daniel can take: open decisions, then unflagged blockers waiting on Daniel. */
	to_unblock: TrackerDigestItem[];
	generated_at: string;
	local_time: string;
	today: string;
	counts: Record<keyof TrackerDigestGroups, number> & {
		/** Daniel decisions that have waited at least a day. */
		stale_decisions: number;
		projects: number;
		to_unblock: number;
	};
};
