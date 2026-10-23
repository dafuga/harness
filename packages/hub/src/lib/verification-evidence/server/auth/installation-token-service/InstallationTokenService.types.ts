import type { GithubAppConfig } from '../../../../../utils/verification-evidence/authConfig';
import type { GithubApiAdapter } from '../GithubApiAdapter';

export interface CachedInstallationToken {
	token: string;
	expiresAt: number;
}

export interface InstallationTokenOptions {
	app: GithubAppConfig;
	api: GithubApiAdapter;
	/** Isolate memory only. Tokens are never written to a store. */
	cache: Map<string, CachedInstallationToken>;
	now: () => number;
}
