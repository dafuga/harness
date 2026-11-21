export interface TrackerMatchRow {
	readonly id: string;
	readonly title: string | null;
	readonly status: string | null;
	readonly agent?: string | null;
	readonly owner?: string | null;
	readonly question?: string | null;
	readonly needs_daniel?: number | boolean;
	readonly resolved?: number | boolean;
	readonly deleted?: number | boolean;
	readonly ignored_reason?: string | null;
	readonly ignored_by?: string | null;
	readonly ignored_at?: string | null;
	readonly ignored_until?: string | null;
}

export interface TrackerMatchOptions {
	readonly agent?: unknown;
	readonly excludeId?: string;
}

export interface TrackerItemMatch {
	id: string;
	title: string;
	status: string;
	agent: string | null;
	owner: string | null;
	question: string | null;
	needs_daniel: boolean;
	score: number;
	shared: string[];
	same_agent: boolean;
	ignored_reason?: string | null;
	ignored_by?: string | null;
	ignored_at?: string | null;
	ignored_until?: string | null;
}

export interface TrackerItemMatches {
	ignored: TrackerItemMatch[];
	open: TrackerItemMatch[];
}

export interface TrackerDuplicateDetails {
	code: 'ignored_duplicate' | 'open_duplicate';
	matches: TrackerItemMatch[];
}

export type TrackerCandidateRow = TrackerMatchRow & { title: string; status: string };
