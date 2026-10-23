export interface Summary {
	commit: string;
	coverage: string;
	gaps: string[];
	records: Array<{ id: string; status: string; valid: boolean }>;
	committedAt: string;
	subject: string;
	detail: string;
}

export interface Index {
	sourceRepository?: string;
	schemaVersion: number;
	branches: Array<{ name: string; head: string }>;
	revisions: Summary[];
	units: Array<{ id: string; growth: Array<{ commit: string; 'source-bytes': number }> }>;
	benchmarks: Array<{
		unit: string;
		metric: string;
		workload: string;
		incompatible: boolean;
		series: Array<{
			profile: string;
			unitOfMeasure: string;
			points: Array<{ commit: string; value: number }>;
		}>;
	}>;
	problems: string[];
}

export interface Built {
	out: string;
	digest: string;
	media: { resolved: number; missing: number };
	problems: string[];
	index: Index;
}

export interface Detail {
	commit: string;
	registry: {
		available: boolean;
		units: Array<{
			id: string;
			sourceMeasurements?: Array<{ metric: string; value: number | null; testedRevision: string }>;
			helpers?: Array<{ name: string; source: string; inputs: Array<{ name: string }> }>;
		}>;
		graph: {
			nodes: Array<{ id: string }>;
			edges: Array<{ from: string; to: string; via: string }>;
		};
	};
	comparison: {
		base: string;
		units: { direct: string[]; indirect: string[]; added: string[] };
	} | null;
	records: Array<{
		id: string;
		scenarios: Array<{
			id: string;
			status: string;
			inherited: boolean;
			origin: { record: string; commit: string };
			states: Array<{ captures: Array<{ media: string | null; sha256: string; gap?: string }> }>;
		}>;
	}>;
	explanations: Array<{ unit: string; symbol: string; behavior: string }>;
}

export interface IndexedCommits {
	failed: string;
	baseline: string;
	changed: string;
	unverified: string;
}
