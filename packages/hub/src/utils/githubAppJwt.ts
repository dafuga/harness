

export interface GithubAppJwtInput {
	appId: string;
	key: CryptoKey;
	now: number;
}

export { githubAppKey, githubAppJwt } from '../services/installation-token-service/githubAppJwt';
