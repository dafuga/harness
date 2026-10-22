/** The bounds the contract leaves to the relay. Protocol limits are `remoteLimits`. */
export const relayConfig = {
	/** Where a host object is addressed. Never resolved: a namespace binding carries the request. */
	internalOrigin: 'https://relay.internal',
	/** JSON bodies are read up to 16 KiB and no further. */
	bodyBytes: 16 * 1024,
	/** Environments in which nothing is served over plain HTTP. */
	tlsEnvironments: ['production', 'staging'],
	/** The fixed window of both rate limits. */
	rateWindowMs: 60_000,
	/** Public pairing calls per host and window. A phone polls every two seconds: 30 of them. */
	pairingCalls: 600,
	/** Failed connects per host and window that are still answered 401; later ones get 429. */
	failedConnects: 20,
	/** Offers a host may hold at a time. */
	openPairings: 64,
	/** Frames one device connection may send per window before it is closed with 4429. */
	frameWindowMs: 10_000,
	deviceFrames: 1200,
	/** How long an expired offer is kept, so that a phone that polls is told `expired`. */
	sweepDelayMs: 2_500
} as const;
