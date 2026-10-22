/** One ref as Git lists it; `symbolic` is the ref it points to when it has no tip of its own. */
export interface ListedRef {
	ref: string;
	head: string;
	symbolic?: string;
}

export interface SourceBranch {
	name: string;
	head: string;
}

export { sourceBranches } from '../../repositories/git-source-history/source-history-repository/sourceBranches';
