/**
 * How the Electron renderer reaches its own main process: a WebSocket that never leaves the
 * machine, carrying the same wire messages as a phone's channel, in plain text frames.
 */
export const localTransport = {
	path: '/v1/local',
	protocol: 'harness.v1',
	/** The one-use ticket travels as a second subprotocol: never in the address, never stored. */
	ticketPrefix: 'ticket.',
	/** The only page that may connect. */
	origin: 'harness://app',
	ticketMs: 10000,
	/** Tickets that may be waiting to be used, over all windows. */
	tickets: 8,
	clients: 4,
	/** Messages one side may have in flight, partly sent. */
	streams: 8,
	/**
	 * The largest request of the app page: a game document of at most 1 MiB, with an envelope no
	 * larger than any request of a phone. Phones keep `remoteLimits.requestBytes`; frames do not
	 * grow, the request only has more of them.
	 */
	requestBytes: 1048576 + 65536
} as const;
