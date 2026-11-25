import type { Native } from './syncSocket.types';
/** A WebSocket client for the sync API that keeps every message, text or binary, in order. */
export class SyncSocket {
	readonly messages: (string | Uint8Array)[] = [];
	closed: number | null = null;

	private constructor(
		private readonly socket: Native,
		private readonly log: (string | Uint8Array)[]
	) {
		socket.binaryType = 'arraybuffer';
		socket.addEventListener('message', ({ data }) => {
			const message = typeof data === 'string' ? data : new Uint8Array(data);
			this.messages.push(message);
			this.log.push(message);
		});
		socket.addEventListener('close', (event) => {
			this.closed = event.code ?? 1005;
		});
	}

	static open(url: string, log: (string | Uint8Array)[] = []): Promise<SyncSocket> {
		const Socket = globalThis.WebSocket as unknown as new (url: string) => Native;
		const socket = new Socket(url);
		const opened = new SyncSocket(socket, log);
		return new Promise((resolve, reject) => {
			socket.addEventListener('open', () => resolve(opened));
			socket.addEventListener('error', () => reject(new Error('the socket did not open')));
		});
	}

	send(data: string | Uint8Array): void {
		this.log.push(data);
		this.socket.send(data);
	}

	close(): void {
		this.socket.close();
	}

	/** Waits until `count` messages have arrived, or fails after two seconds. */
	async until(count: number): Promise<(string | Uint8Array)[]> {
		for (let waited = 0; this.messages.length < count; waited += 10) {
			if (waited > 2000) throw new Error(`expected ${count} messages, got ${this.messages.length}`);
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
		return this.messages;
	}

	/** The JSON text messages so far. */
	texts(): Record<string, unknown>[] {
		return this.messages
			.filter((message): message is string => typeof message === 'string')
			.map((text) => JSON.parse(text) as Record<string, unknown>);
	}
}
