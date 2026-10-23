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
