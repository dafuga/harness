// @harness-uid u_twodka4wdn
import type { Duplex } from 'node:stream';
import { clearInterval, setInterval } from 'node:timers';
import type { WebSocket } from 'ws';

const maxBuffered = 8 * 1024 * 1024;

/** Copies VNC bytes both ways between an approved viewer and the container's screen. */
export function bridgeScreen(socket: WebSocket, screen: Duplex): void {
	screen.on('data', (chunk: Buffer) => {
		socket.send(chunk, { binary: true });
		// A slow phone pauses the screen instead of growing this process without bound.
		if (socket.bufferedAmount > maxBuffered) {
			screen.pause();
			const resume = setInterval(() => {
				if (socket.bufferedAmount > maxBuffered) return;
				clearInterval(resume);
				screen.resume();
			}, 100);
			socket.once('close', () => clearInterval(resume));
		}
	});
	screen.once('end', () => socket.close());
	screen.once('error', () => socket.terminate());
	socket.on('message', (data: Buffer) => void screen.write(data));
	socket.on('error', () => socket.terminate());
	socket.once('close', () => screen.destroy());
}
