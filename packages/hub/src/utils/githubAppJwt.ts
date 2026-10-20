export interface GithubAppJwtInput {
	appId: string;
	key: CryptoKey;
	now: number;
}

export {
	githubAppKey,
	githubAppJwt
} from '../lib/server/auth/installation-token-service/githubAppJwt';
