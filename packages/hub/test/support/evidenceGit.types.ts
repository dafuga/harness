import type { RepositoryIdentity } from 'collaboration';

export interface FakeCommit {
	files: Map<string, Uint8Array>;
	parents: string[];
	subject: string;
	author: string;
	committedAt: string;
}

/** One repository as GitHub holds it: commits, refs and the objects of its LFS store. */
export interface FakeGit {
	commits: Map<string, FakeCommit>;
	refs: Map<string, string>;
	lfs: Map<string, Uint8Array>;
	/** Adds a commit under a name that decides its hash, and answers with that hash. */
	commit(label: string, files: Map<string, Uint8Array>, parents?: string[]): string;
	/** The tree of a commit that is held. */
	tree(commit: string): string;
}

export interface Reader {
	git(repository: RepositoryIdentity): FakeGit;
	held(repository: RepositoryIdentity, commit: string): FakeCommit;
	blob(repository: RepositoryIdentity, input: { commit: string; path: string }): Uint8Array;
}
