export interface HubEnv {
	HARNESS_GOOGLE_CLIENT_ID?: string;
	HARNESS_SESSION_SECRET?: string;
	HARNESS_PUBLIC_ORIGIN?: string;
	HARNESS_ENVIRONMENT?: 'local' | 'staging' | 'production';
	HARNESS_GITHUB_APP_ID?: string;
	HARNESS_GITHUB_PRIVATE_KEY?: string;
	HARNESS_GITHUB_CLIENT_ID?: string;
	HARNESS_GITHUB_CLIENT_SECRET?: string;
	HARNESS_COLLABORATION_OWNER?: string;
	HARNESS_COLLABORATION_REPO?: string;
	HARNESS_COLLABORATION_REPOSITORY_ID?: string;
	HARNESS_COLLABORATION_INSTALLATION_ID?: string;
	HARNESS_EMAIL_API_KEY?: string;
	HARNESS_EMAIL_FROM?: string;
	/** The relay hosts and phones connect to. With `REMOTE_HOSTS` it enables the remote host API. */
	HARNESS_RELAY_ORIGIN?: string;
	DB?: D1Database;
	CACHE?: R2Bucket;
	/** The relay's host objects, reachable through this binding only. */
	REMOTE_HOSTS?: DurableObjectNamespace;
}
const names = [
	'HARNESS_GOOGLE_CLIENT_ID',
	'HARNESS_SESSION_SECRET',
	'HARNESS_PUBLIC_ORIGIN',
	'HARNESS_ENVIRONMENT',
	'HARNESS_GITHUB_APP_ID',
	'HARNESS_GITHUB_PRIVATE_KEY',
	'HARNESS_GITHUB_CLIENT_ID',
	'HARNESS_GITHUB_CLIENT_SECRET',
	'HARNESS_COLLABORATION_OWNER',
	'HARNESS_COLLABORATION_REPO',
	'HARNESS_COLLABORATION_REPOSITORY_ID',
	'HARNESS_COLLABORATION_INSTALLATION_ID',
	'HARNESS_EMAIL_API_KEY',
	'HARNESS_EMAIL_FROM',
	'HARNESS_RELAY_ORIGIN'
] as const;
/** Only product-dedicated settings are accepted; unrelated host credentials never enter runtime. */
export function hubEnvConfig(input: Record<string, unknown>): HubEnv {
	const env = Object.fromEntries(
		names.flatMap((key) => (typeof input[key] === 'string' ? [[key, input[key]]] : []))
	) as HubEnv;
	if (input.DB) env.DB = input.DB as D1Database;
	if (input.CACHE) env.CACHE = input.CACHE as R2Bucket;
	if (input.REMOTE_HOSTS) env.REMOTE_HOSTS = input.REMOTE_HOSTS as DurableObjectNamespace;
	return env;
}
