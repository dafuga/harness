// @harness-uid u_xba7ieg4je
import type {
	TrackerBlockerRoute,
	TrackerBlockerType
} from '../../utils/projects-sessions/trackerBlockerTypes.types';
import type { TrackerItemPriority } from '../../utils/projects-sessions/normalizeTrackerItemFields.types';
import type { trackerItemFields } from '../../adapters/projects-sessions/TrackerSchemaAdapter';

import type {
	TrackerPlanning,
	TrackerStage
} from '../../utils/projects-sessions/trackerPlanning.types';

type ItemFlags = 'needs_daniel' | 'resolved' | 'deleted';

export type TrackerItemRow = Omit<
	Record<(typeof trackerItemFields)[number], string | null>,
	ItemFlags
> &
	Record<ItemFlags, number> & {
		id: string;
		updated_at: string | null;
		clocks: string;
		chased_clock?: string | null;
		chased_by?: string | null;
		chased_reason?: string | null;
		chased_count?: number | null;
		blocker_note?: string | null;
		blocker_note_clock?: string | null;
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
	overdue: TrackerDigestItem[];
	due_today: TrackerDigestItem[];
	recurring_missed: TrackerRecurringProblem[];
	chased_7d: TrackerDigestItem[];
	queued: (TrackerDigestItem & {
		requested_at: string;
		waiting_minutes: number;
		computer: string | null;
	})[];
};

export type TrackerDigest = TrackerDigestGroups & {
	generated_at: string;
	local_time: string;
	today: string;
	counts: Record<keyof TrackerDigestGroups, number>;
};

export type TrackerBlocker = {
	id: string;
	title: string;
	kind: 'block' | 'flag' | 'block+flag' | 'note';
	type: TrackerBlockerType;
	label: string;
	route: TrackerBlockerRoute;
	route_to: string | null;
	owner: string | null;
	agent: string | null;
	parent: string | null;
	/** The exact blocked reason or question. */
	action: string;
	since: string;
	age_minutes: number;
	escalated: boolean;
	/** A Daniel-typed block that has not reached Needs Daniel. */
	needs_escalation: boolean;
	stale: boolean;
	chased_at: string | null;
	waits_on: string | null;
	dependency_status: string | null;
	recheck: string | null;
	/** Other items deduplicated into this one. */
	duplicates: string[];
};

export type TrackerBlockerGroup = {
	type: TrackerBlockerType;
	label: string;
	items: TrackerBlocker[];
};

export type TrackerBlockerInbox = {
	generated_at: string;
	total: number;
	unescalated: number;
	stale: number;
	groups: TrackerBlockerGroup[];
};
