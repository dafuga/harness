import type { RemoteSocket } from '../../../../remote/src/index';

interface SocketEvent {
	data?: unknown;
	code?: number;
}
interface HeaderSocket {
	readyState: number;
	send(text: string): void;
	close(code?: number): void;
	addEventListener(type: string, listener: (event: SocketEvent) => void): void;
}
/** The WebSocket of the main process (not of a page): it can send request headers. */
type HeaderSocketConstructor = new (
	url: string,
	options: { headers: Record<string, string> }
) => HeaderSocket;
export interface RelaySocketAdapterConfig {
	socket?: HeaderSocketConstructor;
}
const open = 1;

/** Opens a socket to the relay with the credential in a request header, never in the address. */
export class RelaySocketAdapter {
	constructor(private readonly config: RelaySocketAdapterConfig = {}) {}
	open(url: string, headers: Record<string, string>): RemoteSocket {
		const Socket = this.config.socket ?? (WebSocket as unknown as HeaderSocketConstructor),
			socket = new Socket(url, { headers });
		const opened = new Promise<void>((resolve, reject) => {
			socket.addEventListener('open', () => resolve());
			socket.addEventListener('error', () => reject(new Error('The relay could not be reached.')));
		});
		opened.catch(() => undefined);
		return {
			opened,
			send: (text) => {
				if (socket.readyState === open) socket.send(text);
			},
			close: (code = 1000) => socket.close(code),
			onMessage: (listener) =>
				socket.addEventListener('message', (event) => {
					if (typeof event.data === 'string') listener(event.data);
				}),
			onClose: (listener) =>
				socket.addEventListener('close', (event) => listener(event.code ?? 1006))
		};
	}
}
