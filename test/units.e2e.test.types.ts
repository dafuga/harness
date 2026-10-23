export interface Manifest {
	id: string;
	kind: string;
	status: string;
	responsibility: string;
	owns: { source: string[]; symbols: string[] };
	contract: { origin: string; inputs: Item[]; outputs: Item[]; errors: Item[] };
	dependencies: Array<{ unit: string; via: string; origin: string }>;
	runtime: { kind: string; entry: string };
	scenarios: string[];
	budgets: { size: string; complexity: string };
}

export interface Item {
	name: string;
	type: string;
}

export interface IndexResult {
	added: string[];
	updated: string[];
	moved: Array<{ id: string; from: string; to: string }>;
	revived: string[];
	orphaned: string[];
}
