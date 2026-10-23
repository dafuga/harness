import type { GitHubOptions } from '../src/models/Collaboration.types';

export type Call = { path: string; method: string; body: Record<string, unknown> };

export interface State {
	counter: number;
	head: string;
	public: boolean;
	missing: boolean;
	beforePatch: (() => void) | null;
	commits: Map<string, { parent: string; tree: string }>;
	trees: Map<string, string>;
	blobs: Map<string, string>;
	calls: Call[];
	scopes: Parameters<GitHubOptions['token']>[0][];
}
