export interface Graph {
	nodes: Array<{ id: string; kind: string; unit?: string }>;
	edges: Array<{ from: string; to: string; via: string }>;
	uncertain: Array<{ node: string; reason: string; detail: string }>;
}
