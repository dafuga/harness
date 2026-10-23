export interface Unit {
	id: string;
	title: string;
	responsibility: string;
	dependencies: Array<{ unit: string; via: string }>;
	owns: { source: string[]; symbols: string[] };
	scenarios: string[];
	helpers?: Array<{ name: string; source: string; inputs: Array<{ name: string; type: string }> }>;
}

export interface Detail {
	registry: { units: Unit[]; graph: { edges: Array<{ from: string; to: string; via: string }> } };
	records: Array<{ status: string; failures: string[] }>;
}
