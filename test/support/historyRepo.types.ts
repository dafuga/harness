export interface NoteLine {
	kind: string;
	record?: string;
	status?: string;
	id?: string;
	source?: { commit: string; tree: string; base: string | null };
	evidence?: { commit: string; path: string; manifest: string };
	explanation?: { unit: string; symbol: string };
}

export interface Attached {
	record: string;
	status: string;
	source: string;
	evidence: { commit: string; path: string; manifest: string };
	note: string;
	archive: string;
	created: boolean;
}

export interface HistoryStatus {
	commit: string;
	verified: boolean;
	records: Array<{ record: string; status: string; valid: boolean; problems: string[] }>;
	problems: string[];
}
