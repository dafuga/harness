import type { LocalBootstrap } from '../../../../../remote/src/index';

/** The WebSocket of a page, or anything shaped like it. */
export interface LocalSocketPort {
	send(text: string): void;
	close(): void;
	onopen: ((event: unknown) => void) | null;
	onmessage: ((event: { data: unknown }) => void) | null;
	onclose: ((event: unknown) => void) | null;
}

export interface LocalTransportClientOptions {
	/** Asks the main process for a ticket. In the app this is the one IPC call of the preload. */
	bootstrap: () => Promise<LocalBootstrap>;
	open: (url: string, protocols: string[]) => LocalSocketPort;
	retryMs?: number[];
	deadlineMs?: number;
}
