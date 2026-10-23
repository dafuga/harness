/** What the seed recorded about the explorer's part of the synthetic history. */
export interface SeededExplorer {
	explorerBranch: string;
	explorerUnits: Record<'page' | 'list' | 'row' | 'slugify' | 'config' | 'service', string>;
}

export interface Judging {
	id: string;
	status: string;
	valid: boolean;
	finishedAt: string;
	source: { commit: string };
	scenarios: Array<{
		id: string;
		inherited: boolean;
		origin: { commit: string };
		states: Array<{
			id: string;
			captures: Array<{
				kind: string;
				viewport?: string;
				sha256: string;
				media: string | null;
			}>;
		}>;
	}>;
}
