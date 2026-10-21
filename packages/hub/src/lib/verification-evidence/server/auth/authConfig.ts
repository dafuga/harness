import type {
	CollaborationScope,
	GithubAppConfig,
	AuthConfig
} from '../../../../utils/verification-evidence/authConfig';
import type { AuthEnv, HubEnvironment } from '../../../../models/accounts-access/HubAuth.types';

const environments: readonly string[] = ['local', 'staging', 'production'];

const loopback = ['localhost', '127.0.0.1', '[::1]'];

function environmentOf(value: string | undefined): HubEnvironment | null {
	return value && environments.includes(value) ? (value as HubEnvironment) : null;
}

function exactOrigin(url: URL): boolean {
	return !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
}

function originOf(value: string | undefined, environment: HubEnvironment): string | null {
	if (!value || !URL.canParse(value)) return null;
	const url = new URL(value);
	const localHttp =
		environment === 'local' && url.protocol === 'http:' && loopback.includes(url.hostname);
	if (url.protocol !== 'https:' && !localHttp) return null;
	return exactOrigin(url) ? url.origin : null;
}

function positive(value: string | undefined): number | null {
	if (!value || !/^[1-9]\d{0,15}$/.test(value)) return null;
	return Number(value);
}

function collaborationOf(env: AuthEnv): CollaborationScope | null {
	const repositoryId = positive(env.HARNESS_COLLABORATION_REPOSITORY_ID);
	const installationId = positive(env.HARNESS_COLLABORATION_INSTALLATION_ID);
	return repositoryId && installationId ? { repositoryId, installationId } : null;
}

function githubOf(env: AuthEnv): GithubAppConfig | null {
	const appId = env.HARNESS_GITHUB_APP_ID;
	const privateKey = env.HARNESS_GITHUB_PRIVATE_KEY;
	const clientId = env.HARNESS_GITHUB_CLIENT_ID;
	const clientSecret = env.HARNESS_GITHUB_CLIENT_SECRET;
	if (!appId || !privateKey || !clientId || !clientSecret) return null;
	if (!/^[1-9]\d{0,15}$/.test(appId) || !/^[A-Za-z0-9._-]{1,100}$/.test(clientId)) return null;
	return { appId, privateKey, clientId, clientSecret, collaboration: collaborationOf(env) };
}

/** Null disables sign-in entirely. Nothing here falls back to a default credential. */
export function authConfig(env: AuthEnv): AuthConfig | null {
	const clientId = env.HARNESS_GOOGLE_CLIENT_ID;
	const secret = env.HARNESS_SESSION_SECRET;
	const environment = environmentOf(env.HARNESS_ENVIRONMENT);
	if (!clientId || !/^[A-Za-z0-9._-]{1,200}$/.test(clientId)) return null;
	if (!secret || secret.length < 32 || !environment) return null;
	const origin = originOf(env.HARNESS_PUBLIC_ORIGIN, environment);
	return origin ? { clientId, secret, origin, environment, github: githubOf(env) } : null;
}
