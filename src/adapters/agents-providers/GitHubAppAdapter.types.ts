// @harness-uid u_kg5hqd5nop
/** Supplies the App private key only for the duration of one signing call. */
export interface GitHubKeyAccess {
	withKey<T>(use: (privateKeyPem: string) => Promise<T>): Promise<T>;
}

export interface GitHubAppAdapterConfig {
	appId: string;
	installationId: string;
	owner: string;
	repo: string;
	key: GitHubKeyAccess;
	fetch?: typeof fetch;
	now?: () => number;
}

export type GitHubTokenScope = 'read' | 'issues';

export interface GitHubIssueInput {
	title: string;
	body: string;
	labels?: readonly string[];
}
