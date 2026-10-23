import type { SocketClose, SocketRefusal, Frame } from './relaySocket.types';
import WebSocket from 'ws';

/** A real WebSocket client that keeps every text frame in the order it arrived. */
export class RelaySocket {
	readonly closed: Promise<SocketClose>;
	private readonly frames: string[] = [];
	private cursor = 0;
	private wake: () => void = () => undefined;

	private constructor(private readonly socket: WebSocket) {
		socket.on('message', (data, binary) => {
			this.frames.push(binary ? '<binary>' : data.toString('utf8'));
			this.wake();
		});
		this.closed = new Promise((resolve) => {
			socket.on('close', (code, reason) => resolve({ code, reason: reason.toString('utf8') }));
		});
	}

	/** Opens a socket, or throws with the status the upgrade was refused with. */
	static open(url: string, headers: Record<string, string>): Promise<RelaySocket> {
		return new Promise((resolve, reject) => {
			const socket = new WebSocket(url, { headers });
			const opened = new RelaySocket(socket);
			socket.on('open', () => resolve(opened));
			socket.on('error', (error) => reject(error));
			socket.on('unexpected-response', (_request, response) => {
				response.resume();
				socket.terminate();
				reject(new Error(`upgrade refused with ${response.statusCode}`));
			});
		});
	}

	/** Resolves with the refusal of an upgrade, and throws when the socket opens after all. */
	static refusal(url: string, headers: Record<string, string>): Promise<SocketRefusal> {
		return new Promise((resolve, reject) => {
			const socket = new WebSocket(url, { headers });
			socket.on('open', () => {
				socket.terminate();
				reject(new Error('the socket was opened'));
			});
			socket.on('error', (error) => reject(error));
			socket.on('unexpected-response', (_request, response) => {
				const chunks: Buffer[] = [];
				response.on('data', (chunk: Buffer) => chunks.push(chunk));
				response.on('end', () => {
					socket.terminate();
					resolve({
						status: response.statusCode ?? 0,
						error: errorOf(Buffer.concat(chunks).toString('utf8')),
						upgrade: response.headers.upgrade ?? null
					});
				});
			});
		});
	}

	send(frame: unknown): void {
		if (frame instanceof Uint8Array) return this.socket.send(frame);
		this.socket.send(typeof frame === 'string' ? frame : JSON.stringify(frame));
	}

	close(): void {
		this.socket.close(1000);
	}

	/** The next unread text frame as it was sent. */
	async text(timeoutMs = 3000): Promise<string> {
		const deadline = Date.now() + timeoutMs;
		while (this.cursor >= this.frames.length) {
			const left = deadline - Date.now();
			if (left <= 0) throw new Error('no frame arrived in time');
			await this.arrival(left);
		}
		return this.frames[this.cursor++];
	}

	/** The next unread frame, parsed. */
	async next(timeoutMs = 3000): Promise<Frame> {
		return JSON.parse(await this.text(timeoutMs)) as Frame;
	}

	/** The next unread frame of a type; frames of other types before it are skipped. */
	async until(type: string, timeoutMs = 3000): Promise<Frame> {
		for (;;) {
			const frame = await this.next(timeoutMs);
			if (frame.type === type) return frame;
		}
	}

	/** Every unread frame, once none has arrived for a quiet period; parsed where it is JSON. */
	async drain(quietMs = 250): Promise<unknown[]> {
		let seen = -1;
		while (seen !== this.frames.length) {
			seen = this.frames.length;
			await new Promise((resolve) => setTimeout(resolve, quietMs));
		}
		const unread = this.frames.slice(this.cursor);
		this.cursor = this.frames.length;
		return unread.map((frame) => parsed(frame));
	}

	private arrival(timeoutMs: number): Promise<void> {
		return new Promise((resolve) => {
			const timer = setTimeout(resolve, timeoutMs);
			this.wake = () => {
				clearTimeout(timer);
				resolve();
			};
		});
	}
}

function parsed(frame: string): unknown {
	try {
		return JSON.parse(frame);
	} catch {
		return frame;
	}
}

function errorOf(body: string): string | null {
	const value = parsed(body);
	if (typeof value !== 'object' || value === null) return null;
	const error = (value as { error?: unknown }).error;
	return typeof error === 'string' ? error : null;
}

export type { SocketClose, SocketRefusal, Frame } from './relaySocket.types';
