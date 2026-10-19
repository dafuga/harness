/** What a policy may look at: the request and whatever the host put on it server-side. */
export interface ConsoleRequest {
	request: Request;
	url: URL;
	locals?: unknown;
	platform?: unknown;
	/** The address of the peer that opened the connection, as the server itself saw it. */
	getClientAddress?: () => string;
}

/** Decides, on the server, whether one request may see the console. Anything but true denies. */
export type ConsolePolicy = (event: ConsoleRequest) => boolean | Promise<boolean>;

export interface OwnerMode {
	/** Must be exactly `loopback`; owner mode is never assumed. */
	mode?: string;
	/** The address the server was told to listen on. */
	bind?: string;
	/** Set when the server takes the client address from a header, which a client controls. */
	addressHeader?: string;
}

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

/** The default for any host that has not supplied a policy. */
export const denyAll: ConsolePolicy = () => false;
