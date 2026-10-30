export interface Graph {
	nodes: Array<{ id: string; kind: string; unit?: string }>;
	edges: Array<{ from: string; to: string; via: string; typeOnly?: boolean }>;
	uncertain: Array<{ node: string; reason: string; detail: string }>;
}
