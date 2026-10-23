import type { HubRemoteRuntime } from '../../../utils/networking-security/hubRemote';
import { RelayManageAdapter } from './RelayManageAdapter';
import type { HubEnv } from '../../../configs/development-tooling/hubEnvConfig';

const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

function exactOrigin(url: URL): boolean {
	return !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
}

/** An exact https origin, or http on this machine outside production. Anything else is missing. */
function originOf(env: HubEnv): string | null {
	const value = env.HARNESS_RELAY_ORIGIN;
	if (!value || !URL.canParse(value)) return null;
	const url = new URL(value);
	const local = env.HARNESS_ENVIRONMENT !== 'production' && LOCAL_HOSTS.includes(url.hostname);
	const allowed = url.protocol === 'https:' || (url.protocol === 'http:' && local);
	return allowed && exactOrigin(url) ? url.origin : null;
}

/** A plain setting of the same name is not a binding: it has to be able to address an object. */
function bindingOf(env: HubEnv): DurableObjectNamespace | null {
	const hosts = env.REMOTE_HOSTS as Partial<DurableObjectNamespace> | undefined;
	const usable = typeof hosts?.idFromName === 'function' && typeof hosts.get === 'function';
	return usable ? (hosts as DurableObjectNamespace) : null;
}

/** The parts of the remote host API, or null: without the binding and the origin it is disabled. */
export function hubRemote(env: HubEnv): HubRemoteRuntime | null {
	const origin = originOf(env),
		hosts = bindingOf(env);
	return origin && hosts ? { origin, relay: new RelayManageAdapter({ hosts }) } : null;
}
