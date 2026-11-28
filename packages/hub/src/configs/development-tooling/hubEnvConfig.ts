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
	'HARNESS_RELAY_ORIGIN',
	'HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID',
	'HARNESS_PUSH_PUBLIC_KEY'
] as const;
/** Only product-dedicated settings are accepted; unrelated host credentials never enter runtime. */
export function hubEnvConfig(input: Record<string, unknown>): HubEnv {
	const env = Object.fromEntries(
		names.flatMap((key) => (typeof input[key] === 'string' ? [[key, input[key]]] : []))
	) as HubEnv;
	if (input.DB) env.DB = input.DB as D1Database;
	if (input.CACHE) env.CACHE = input.CACHE as R2Bucket;
	if (input.EVIDENCE) env.EVIDENCE = input.EVIDENCE as R2Bucket;
	if (input.REMOTE_HOSTS) env.REMOTE_HOSTS = input.REMOTE_HOSTS as DurableObjectNamespace;
	const sync = input.ACCOUNT_SYNC as Partial<DurableObjectNamespace> | undefined;
	if (typeof sync?.idFromName === 'function' && typeof sync.get === 'function')
		env.ACCOUNT_SYNC = sync as DurableObjectNamespace;
	return env;
}

export type { HubEnv } from './hubEnvConfig.types';
