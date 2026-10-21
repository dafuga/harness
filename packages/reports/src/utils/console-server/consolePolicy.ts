import type { OwnerMode, ConsolePolicy } from '../../../../../src/utils/consolePolicy';

const loopback = /^(127(\.\d{1,3}){3}|::1|::ffff:127(\.\d{1,3}){3}|localhost)$/;

export function loopbackAddress(address: string | undefined): boolean {
	return loopback.test((address ?? '').trim().toLowerCase());
}

/**
 * The policy of Harness's own local server. It admits a request only when owner mode was
 * switched on explicitly, the server was bound to a loopback address, and the connection itself
 * comes from loopback. Host, Forwarded and similar headers are never consulted: a client writes
 * them. A hosted application gets no access from this policy and must supply its own.
 */
export function consolePolicy(owner: OwnerMode): ConsolePolicy {
	const enabled =
		owner.mode === 'loopback' && loopbackAddress(owner.bind) && !owner.addressHeader?.trim();
	return (event) => {
		if (!enabled || !event.getClientAddress) return false;
		try {
			return loopbackAddress(event.getClientAddress());
		} catch {
			return false;
		}
	};
}
