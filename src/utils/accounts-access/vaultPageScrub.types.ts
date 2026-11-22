// @harness-uid u_rzug3edbcj

/** One element of the gateway's page snapshot. */
export interface VaultPageNode {
	tag: string;
	role?: string;
	name?: string;
	type?: string;
	value?: string;
	attributes?: Record<string, string>;
	children?: VaultPageNode[];
}

export interface VaultPageSnapshot {
	url: string;
	title: string;
	nodes: VaultPageNode[];
}

export interface VaultScrubResult {
	snapshot: VaultPageSnapshot;
	removed: number;
}
