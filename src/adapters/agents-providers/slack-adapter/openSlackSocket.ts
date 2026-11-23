// @harness-uid u_q2c7gkxgki
import { createWebSocketStream, WebSocket } from 'ws';
import type { SlackSocketConnection } from './openSlackSocket.types';

const maxFrameBytes = 256 * 1024;
const idleTimeoutMs = 90_000;

/** Connect to the validated, transient URL without redirects or provider error text. */
export function openSlackSocket(url: URL, signal: AbortSignal): SlackSocketConnection {
	const socket = new WebSocket(url, {
		followRedirects: false,
		handshakeTimeout: 10_000,
		maxPayload: maxFrameBytes
	});
	const stream = createWebSocketStream(socket, { readableObjectMode: true, highWaterMark: 64 });
	const idle = setTimeout(() => socket.terminate(), idleTimeoutMs);
	const active = () => idle.refresh();
	const close = () => socket.terminate();
	socket.on('ping', active);
	socket.on('message', active);
	signal.addEventListener('abort', close, { once: true });
	if (signal.aborted) close();
	return {
		frames: stream,
		ack: (id) =>
			new Promise<void>((resolve, reject) => {
				stream.write(JSON.stringify({ envelope_id: id }), (error) => {
					if (error) reject(error);
					else resolve();
				});
			}),
		close: () => {
			clearTimeout(idle);
			signal.removeEventListener('abort', close);
			stream.destroy();
		}
	};
}
