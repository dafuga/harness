import type { GithubAppConfig } from '../../../../utils/verification-evidence/authConfig';
import type { GithubApiAdapter } from './GithubApiAdapter';
import type { AuthStore } from '../../../../models/accounts-access/HubAuthStore.types';
import type { GithubGrantRecord } from '../../../../models/accounts-access/HubAuthStore.types';
import type { AuthSecrets } from '../../../../utils/verification-evidence/authSecrets';
import type { GithubUser } from '../../../../validators/development-tooling/GithubResponseValidator';
import type { GithubUserToken } from '../../../../validators/development-tooling/GithubResponseValidator';

export interface GithubGrantOptions {
	app: GithubAppConfig;
	api: GithubApiAdapter;
	store: Pick<AuthStore, 'githubStates' | 'grants'>;
	secrets: AuthSecrets;
	origin: string;
	now: () => number;
}

export interface GrantProof {
	user: GithubUser;
	token: GithubUserToken;
}

export type Lifetime = Pick<GithubGrantRecord, 'createdAt' | 'expiresAt'>;
