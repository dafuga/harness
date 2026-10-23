export interface Persisted {
	commit: string;
	base: string | null;
	attached: number;
	missing: string[];
}

export interface Shown {
	explanations: Array<{ unit: string; symbol: string; from: string | null; to: string | null }>;
	rangeReasons: number;
	records: Array<{ id: string }>;
}
