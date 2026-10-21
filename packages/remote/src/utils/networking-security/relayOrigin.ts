import { remotePatterns } from './remoteIdentity';

const loopback = ['localhost', '127.0.0.1', '[::1]'];

function secure(url: URL): boolean {
	return url.protocol === 'https:' || (url.protocol === 'http:' && loopback.includes(url.hostname));
}
/** Nothing but scheme and host: no user information, path, query or fragment. */
function bare(url: URL): boolean {
	return !url.username && !url.password && !url.search && !url.hash && url.pathname === '/';
}
/**
 * The exact origin of a relay, or null: https, or http on this machine only. There is no
 * fallback to a local address.
 */
export function relayOrigin(value: string | undefined): string | null {
	try {
		const url = new URL(value ?? '');
		return secure(url) && bare(url) ? url.origin : null;
	} catch {
		return null;
	}
}
/** Where a host or a device opens its socket. Credentials travel in a header, never here. */
export function relaySocketUrl(origin: string, hostId: string): string {
	const exact = relayOrigin(origin);
	if (!exact || !remotePatterns.hostId.test(hostId)) throw new Error('Invalid relay address.');
	return `${exact.replace(/^http/, 'ws')}/v1/hosts/${hostId}/connect`;
}
