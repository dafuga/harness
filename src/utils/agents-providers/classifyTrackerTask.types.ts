// @harness-uid u_6owiaffoxw
export interface TrackerModelItem {
	title?: string | null;
	notes?: string | null;
	project?: string | null;
	agent?: string | null;
	sensitive?: boolean | number | null;
	model?: string | null;
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
