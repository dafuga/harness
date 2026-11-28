// @harness-uid u_pa2kr3prra
export interface TrackerGithubCommentAdapterConfig {
	account: string;
	userId: number;
	repositories: readonly string[];
	readAccessToken: (signal: AbortSignal) => Promise<string>;
	fetcher?: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>;
}
