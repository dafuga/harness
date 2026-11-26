// @harness-uid u_ijav2xdawt
/** What the small indicator shows: changes are pushed, or they are being polled for meanwhile. */
export type RealtimeState = 'live' | 'reconnecting';

/** A local tracker push: the link state, and whether the tracker moved since the last one. */
export interface TrackerChangeEvent {
	state: RealtimeState;
	changed: boolean;
}

/** The part of a WebSocket the doorbell uses; the browser's and `ws` both have it. */
export interface DoorbellSocket {
	onopen: (() => void) | null;
	onmessage: ((event: { data: unknown }) => void) | null;
	onclose: (() => void) | null;
	onerror: (() => void) | null;
	send(text: string): void;
	close(): void;
}

/** One read that `coalesced` keeps to a single flight. */
export type FlightWork = () => Promise<unknown>;

export interface DoorbellOptions {
	/** Opens one authenticated socket to the account object. May reject without a session. */
	open: () => DoorbellSocket | Promise<DoorbellSocket>;
	/** A topic that changed, or `resync` after every (re)connect to cover what was missed. */
	onChange: (topic: string) => void;
	onState: (state: RealtimeState) => void;
	pingMs?: number;
	retryMs?: number;
	maxRetryMs?: number;
}
