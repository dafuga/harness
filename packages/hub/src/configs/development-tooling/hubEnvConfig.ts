// @harness-uid u_w2bnm5lmqr
import type { HubEnv } from './hubEnvConfig.types';

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
/** Callers pass unvalidated records: the input is any object, and each value is checked on read. */
type EnvValues = Partial<Record<string, string | D1Database | R2Bucket | DurableObjectNamespace>>;
/** Only product-dedicated settings are accepted; unrelated host credentials never enter runtime. */
export function hubEnvConfig(input: object): HubEnv {
	const values = input as EnvValues;
	const env = Object.fromEntries(
		names.flatMap((key) => (typeof values[key] === 'string' ? [[key, values[key]]] : []))
	) as HubEnv;
	if (values.DB) env.DB = values.DB as D1Database;
	if (values.CACHE) env.CACHE = values.CACHE as R2Bucket;
	if (values.REMOTE_HOSTS) env.REMOTE_HOSTS = values.REMOTE_HOSTS as DurableObjectNamespace;
	return env;
}

export type { HubEnv } from './hubEnvConfig.types';
