import { remotePatterns } from '../../../../remote/src/index';
import type { PairingAction, PublicRoute } from '../../models/networking-security/RelayHost.types';
import { matchesPattern } from './matchesPattern';

const hostPath = /^\/v1\/hosts\/([^/]+)\/(.+)$/;
const pairingPath = /^pairings\/([^/]+)(|\/request|\/poll|\/exchange)$/;
const pairingCalls = new Map<string, { method: string; action: PairingAction }>([
	['', { method: 'GET', action: 'info' }],
	['/request', { method: 'POST', action: 'request' }],
	['/poll', { method: 'POST', action: 'poll' }],
	['/exchange', { method: 'POST', action: 'exchange' }]
]);

/**
 * The only requests the relay serves in public (contract §5.1). Everything else, `/manage/*`
 * first of all, is no route. The path of a route is rebuilt from its validated parts.
 */
export function publicRoute(method: string, pathname: string): PublicRoute | undefined {
	if (pathname === '/v1/health') {
		return method === 'GET' ? { kind: 'health', path: pathname } : undefined;
	}
	const [, hostId, rest] = hostPath.exec(pathname) ?? [];
	if (!matchesPattern(hostId, remotePatterns.hostId)) return undefined;
	if (rest !== 'connect') return pairingRoute(method, hostId, rest);
	if (method !== 'GET') return undefined;
	return { kind: 'connect', path: `/v1/hosts/${hostId}/connect`, hostId };
}

function pairingRoute(method: string, hostId: string, rest: string): PublicRoute | undefined {
	const [, pairingId, suffix] = pairingPath.exec(rest) ?? [];
	const call = pairingCalls.get(suffix ?? '-');
	if (!matchesPattern(pairingId, remotePatterns.pairingId)) return undefined;
	if (!call || call.method !== method) return undefined;
	const path = `/v1/hosts/${hostId}/pairings/${pairingId}${suffix}`;
	return { kind: 'pairing', path, hostId, pairingId, action: call.action };
}
