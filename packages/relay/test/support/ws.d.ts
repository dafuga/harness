/** The part of `ws` (installed at the workspace root, without types) that the relay tests use. */
declare module 'ws' {
	import type { ClientRequest, IncomingMessage } from 'node:http';

	export default class WebSocket {
		constructor(url: string, options?: { headers?: Record<string, string> });
		readonly readyState: number;
		on(event: 'open', listener: () => void): this;
		on(event: 'message', listener: (data: Buffer, isBinary: boolean) => void): this;
		on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
		on(event: 'error', listener: (error: Error) => void): this;
		on(
			event: 'unexpected-response',
			listener: (request: ClientRequest, response: IncomingMessage) => void
		): this;
		send(data: string | Uint8Array): void;
		close(code?: number): void;
		terminate(): void;
	}
}
