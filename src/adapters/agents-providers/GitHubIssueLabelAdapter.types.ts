// @harness-uid u_b7mnbsg4vi
export interface GitHubIssueLabelAdapterConfig {
	owner: string;
	repo: string;
	/** A fine-grained or App installation token with Issues write on this repository only. */
	token: () => Promise<string>;
	fetch?: typeof fetch;
}
