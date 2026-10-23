export type Environment = Record<string, string | undefined>;

/** Where one browser run keeps everything it seeds; no two runs share any of it. */
export interface E2eFixtures {
	root: string;
	/** The report store its servers read and its specs write. */
	reports: string;
	/** The seeded console history, its index and the metadata the specs read. */
	console: string;
	analytics: string;
	/**
	 * The copy of the finished build its servers are started from. It lies in the checkout's
	 * cache, where the packages a built server imports resolve, under the name of the run.
	 */
	build: string;
	/** A checkout of a fixture application, by its directory name. */
	site(name: string): string;
}
