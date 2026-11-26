// @harness-uid u_7fbfjj5ip5
export interface QaSyncRunInput {
	config: string;
	state?: string;
	dryRun?: boolean;
	backfillComments?: boolean;
	watch?: boolean;
	/** Seconds between watch passes. */
	interval: number;
	json?: boolean;
	slackTokenFile?: string;
	githubTokenFile?: string;
	tracker: string;
	signal?: AbortSignal;
}
