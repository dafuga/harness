export interface SourceRevision {
	commit: string;
	tree: string;
	parents: string[];
	subject: string;
	author: string;
	authoredAt: string;
	committedAt: string;
	/** Source branches that reach the commit. */
	branches: string[];
	/** True when only an archive ref keeps the commit. */
	retained: boolean;
}

export interface SourceHistory {
	branches: Array<{ name: string; head: string }>;
	revisions: SourceRevision[];
	truncated: boolean;
}
