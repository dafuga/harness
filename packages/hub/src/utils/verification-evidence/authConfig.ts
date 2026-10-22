import type { HubEnvironment } from '../../models/accounts-access/HubAuth.types';

export interface CollaborationScope {
	repositoryId: number;
	installationId: number;
}

export interface GithubAppConfig {
	appId: string;
	privateKey: string;
	clientId: string;
	clientSecret: string;
	/** The only repository a write token may ever be minted for. */
	collaboration: CollaborationScope | null;
}

export interface AuthConfig {
	clientId: string;
	secret: string;
	origin: string;
	environment: HubEnvironment;
	github: GithubAppConfig | null;
}

export { authConfig } from '../../lib/verification-evidence/server/auth/authConfig';
