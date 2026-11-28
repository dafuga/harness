// @harness-uid u_4pgfvaopdt
import type { TrackerMatchRow } from './checkTrackerItem.types';
import type {
	TrackerItemClock,
	TrackerItemFields,
	TrackerItemInput,
	TrackerItemValue
} from './normalizeTrackerItemFields.types';

/** The resolved, undeleted Store row and its original field values. */
export interface TrackerItemSnapshot extends TrackerMatchRow {
	readonly kind?: string | null;
	readonly every?: string | null;
	readonly every_tz?: string | null;
	readonly remind_at?: string | null;
	readonly occurrence?: string | null;
	readonly ignored_prev_status?: string | null;
	readonly options?: string | null;
	readonly confirm?: string | null;
	readonly attachments?: string | null;
	readonly answer_option?: string | null;
	readonly chief_review?: string | null;
	readonly project?: string | null;
	readonly repo?: string | null;
	readonly computer?: string | null;
	readonly model?: string | null;
	readonly sensitive?: boolean | number | string | null;
	readonly auto?: string | null;
	readonly launch_target?: string | null;
	readonly launch_source?: string | null;
}

export type TrackerItemAction =
	| 'update'
	| 'start'
	| 'reopen'
	| 'remove'
	| 'block'
	| 'unblock'
	| 'progress'
	| 'note'
	| 'flag'
	| 'chase'
	| 'park'
	| 'move-on'
	| 'remind'
	| 'priority'
	| 'answer'
	| 'unflag'
	| 'resolve'
	| 'done'
	| 'ignore'
	| 'unignore';

export type TrackerItemMutation<Receipt extends object = object> = {
	readonly body?: TrackerItemInput;
	readonly receipt?: Receipt;
} & (
	| { readonly action: 'add'; readonly itemId: string }
	| { readonly action: TrackerItemAction; readonly item: TrackerItemSnapshot }
);

export interface TrackerItemMutationContext extends TrackerItemClock {
	readonly candidates: readonly TrackerMatchRow[];
	/** Validate a named model against the integration's ladder and project policy. */
	readonly validateModel?: (model: unknown, project: unknown) => void;
	/** Supply launch fields from the integration's placement and admission policy. */
	readonly planLaunch?: (
		fields: TrackerItemInput,
		current?: TrackerItemSnapshot
	) => TrackerItemInput;
}

export interface TrackerItemMutationPlan<Receipt extends object = object> {
	itemId: string;
	fields: TrackerItemFields;
	/** The caller may persist this alongside the operation in one journal transaction. */
	receipt?: Receipt;
}

export interface TrackerItemChange {
	fields: TrackerItemInput;
	appendNote?: TrackerItemValue;
}

export type TrackerItemTransition = (
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
) => TrackerItemChange;

export interface TrackerDuplicateProbe {
	text: string;
	agent?: unknown;
	excludeId?: string;
	force?: unknown;
	askingDaniel?: boolean;
}
