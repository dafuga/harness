import type { GithubGrantService } from './GithubGrantService';
import type { InstallationTokenService } from './installation-token-service/InstallationTokenService';
import type { GithubApiAdapter } from './GithubApiAdapter';

export interface GithubOwnerOptions {
	grants: GithubGrantService;
	tokens: InstallationTokenService;
	api: GithubApiAdapter;
	appId: number;
}
