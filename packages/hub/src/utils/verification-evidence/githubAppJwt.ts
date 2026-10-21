export interface GithubAppJwtInput {
	appId: string;
	key: CryptoKey;
	now: number;
}

export {
	githubAppKey,
	githubAppJwt
} from '../../lib/verification-evidence/server/auth/installation-token-service/githubAppJwt';
