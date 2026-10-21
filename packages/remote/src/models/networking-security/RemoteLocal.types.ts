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
	streams: 8
} as const;
/** What the preload is given over IPC to open its socket. Valid once, for a few seconds. */
export interface LocalBootstrap {
	port: number;
	ticket: string;
}
/**
 * One text frame of a plain transport: a slice of one wire message. `data` is standard base64
 * of at most `chunkBytes` UTF-8 bytes; `index` counts from 0 within `message`; frames of several
 * messages may alternate.
 */
export interface WirePart {
	type: 'part';
	message: number;
	index: number;
	last: boolean;
	data: string;
}
