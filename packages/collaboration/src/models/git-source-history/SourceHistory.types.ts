import type {
	RepositoryIdentity,
	SourceAdapter,
	SourceCommit
} from '../planning-collaboration/Collaboration.types';

/** One commit as Git states it: its parents in their order, its title and who made it when. */
export interface SourceCommitFacts extends SourceCommit {
	parents: string[];
	subject: string;
	author: string;
	committedAt: string;
}
export interface SourceHistoryCommit {
	hash: string;
	subject: string;
	authoredAt: string;
}
export interface SourceHistoryPageInput {
	commit: string;
	paths: string[];
	page?: number;
	perPage?: number;
}
export interface SourceHistoryPage {
	commits: SourceHistoryCommit[];
	complete: boolean;
	nextPage: number | null;
}
export interface SourceHistoryAdapter extends SourceAdapter {
	/** Release only memoized bytes after sequential validation; commit/tree authority is unchanged. */
	releaseBytes?(repository: RepositoryIdentity, input: { commit: string; path: string }): void;
	rawMany?(
		repository: RepositoryIdentity,
		input: { commit: string; paths: string[] }
	): Promise<Map<string, Uint8Array>>;
	raw(repository: RepositoryIdentity, input: { commit: string; path: string }): Promise<Uint8Array>;
	historyPage?(
		repository: RepositoryIdentity,
		input: SourceHistoryPageInput
	): Promise<SourceHistoryPage>;
	branches(repository: RepositoryIdentity): Promise<Array<{ name: string; tip: string }>>;
	commits(
		repository: RepositoryIdentity,
		input: { branch: string; commit?: string }
	): Promise<Array<{ hash: string; subject: string; authoredAt: string }>>;
	changed(repository: RepositoryIdentity, commit: string): Promise<string[]>;
	optionalRef(repository: RepositoryIdentity, ref: string): Promise<SourceCommit | null>;
	/** The commit as the repository states it; null when it holds no such commit. */
	facts?(repository: RepositoryIdentity, commit: string): Promise<SourceCommitFacts | null>;
	/** True when `commit` is `tip` or one of its ancestors; false when either is not held. */
	reaches?(
		repository: RepositoryIdentity,
		input: { tip: string; commit: string }
	): Promise<boolean>;
}
