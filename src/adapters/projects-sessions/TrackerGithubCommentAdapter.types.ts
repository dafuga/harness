export interface TrackerGithubCommentAdapterConfig {
	account: string;
	userId: number;
	repositories: readonly string[];
	readAccessToken: (signal: AbortSignal) => Promise<string>;
	fetcher?: typeof fetch;
}
