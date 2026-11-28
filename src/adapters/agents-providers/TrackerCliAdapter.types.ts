// @harness-uid u_kg5hqe6qrs
export interface TrackerRunner {
	(args: readonly string[]): Promise<string>;
}

export interface TrackerCliAdapterConfig {
	/** Every read is filtered to, and every create is stamped with, this tracker agent. */
	agent: string;
	owner: string;
	run: TrackerRunner;
}

export interface TrackerItemView {
	id: string;
	title: string;
	status: string;
	stage: string;
	priority: string;
	due: string | null;
	owner: string;
	notes: readonly string[];
	runs: readonly string[];
}
