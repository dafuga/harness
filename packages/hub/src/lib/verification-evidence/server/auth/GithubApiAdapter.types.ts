export interface GithubApiOptions {
	fetch: typeof fetch;
}

export interface InstallationScope {
	repository_ids: number[];
	permissions: Record<string, string>;
}

export interface Call {
	method?: string;
	authorization?: string;
	contentType?: string;
	accept?: string;
	body?: string;
}
