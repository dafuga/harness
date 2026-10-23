export interface SocketEvent {
	data?: unknown;
	code?: number;
}

export interface HeaderSocket {
	readyState: number;
	send(text: string): void;
	close(code?: number): void;
	addEventListener(type: string, listener: (event: SocketEvent) => void): void;
}

/** The WebSocket of the main process (not of a page): it can send request headers. */
export type HeaderSocketConstructor = new (
	url: string,
	options: { headers: Record<string, string> }
) => HeaderSocket;

export interface RelaySocketAdapterConfig {
	socket?: HeaderSocketConstructor;
}
