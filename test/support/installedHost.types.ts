import type { VerifyRepo } from './verifyRepo';

export interface HostIndex {
	branches: Array<{ name: string; head: string }>;
	revisions: Array<{ commit: string; records: Array<{ id: string }> }>;
}

export interface SyntheticHost {
	root: string;
	/** The SvelteKit project, with the packed Harness package installed. */
	host: string;
	/** A history index of a small verified repository, as `harness history build` wrote it. */
	data: string;
	index: HostIndex;
	/** A verified commit of that history, and one of its screenshots. */
	commit: string;
	media: string;
	repo: VerifyRepo;
	dispose(): Promise<void>;
}
