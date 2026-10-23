export interface Persisted {
	commit: string;
	base: string | null;
	attached: number;
	missing: string[];
}

/** A reason as it is stored, as far as these tests read it. */
export interface Told {
	unit: string;
	behavior: string;
	recordedAt: string;
}
