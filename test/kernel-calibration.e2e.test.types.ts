export interface Run {
	source: { commit: string | null; dirty: boolean };
	provenance: { kind: string; verified: boolean; note: string };
	measurements: Array<{
		metric: string;
		target: string;
		testedRevision: string | null;
		artifacts: Array<{ sha256: string }>;
	}>;
	default: { runtime: string; basis: string };
}
