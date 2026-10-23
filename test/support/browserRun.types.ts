export interface BrowserRun {
	/** Address of the application server the run starts for its specs. */
	url: string;
	/** Resolves with the exit code once the run and its teardown have finished. */
	finished: Promise<number>;
	/** What the run reported about its own tests; readable once it has finished. */
	results(): { expected: number; unexpected: number; files: string[] };
	/** Each failed test with the first error it raised; empty while no report is written. */
	failures(): string[];
	output(): string;
	/** Ends a run that is still going, with the servers it started; harmless once it finished. */
	stop(): Promise<void>;
}

export interface SeededHistory {
	/** Top-level directory under the scratch directory that holds this history. */
	home: string;
	file: string;
	commits: Record<string, string>;
	/** The branch whose commits record a page before and after a change, and that page's unit. */
	branch: string;
	page: string;
}

export type Ended = Pick<BrowserRun, 'finished' | 'failures' | 'output'>;
