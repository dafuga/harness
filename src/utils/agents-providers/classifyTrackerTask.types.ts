// @harness-uid u_6owiaffoxw
export interface TrackerModelItem {
	title?: string | null;
	notes?: string | null;
	project?: string | null;
	agent?: string | null;
	sensitive?: boolean | number | null;
	model?: string | null;
	/** The model last named with --model. While it equals `model`, no preference or floor changes it. */
	explicit_model?: string | null;
	/** The task type set with --kind; empty means it is inferred. */
	task_type?: string | null;
	/** The item's BRIEF note, read only for a stated coordinator role. */
	brief?: string | null;
}

export type TrackerTaskKind =
	| 'hard'
	| 'ops'
	| 'refactor'
	| 'docs'
	| 'chore'
	| 'bugfix'
	| 'test'
	| 'triage'
	| 'feature';

export type TrackerTaskSize = 'small' | 'medium' | 'large';

export type TrackerTaskRoute = 'live-deploy' | 'computer-use' | 'visual' | 'default';

export const trackerTaskTypes = [
	'coordinator',
	'design',
	'deploy',
	'computer-use',
	'module-job',
	'simple',
	'default',
	'hard'
] as const;

/** What kind of work an item is; it selects the model route. */
export type TrackerTaskType = (typeof trackerTaskTypes)[number];
