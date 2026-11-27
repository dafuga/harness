// @harness-uid u_o472ng3iiw
import { createHash, randomBytes } from 'node:crypto';
import type { Duplex } from 'node:stream';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { clientFrame, readFrames } from './webSocketFrames';
import type { PipeWebSocketHandlers } from './pipeWebSocket.types';

const guid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const maxHandshake = 16 * 1024;

/**
 * A WebSocket client over an already open byte stream. Bun's built-in client cannot use a custom
 * stream, and a host TCP port for DevTools would be reachable beyond this process.
 */
export function pipeWebSocket(
	stream: Duplex,
	path: string,
	handlers: PipeWebSocketHandlers
): Promise<{ send(text: string): void }> {
	const key = randomBytes(16).toString('base64');
	const accept = createHash('sha1')
		.update(key + guid)
		.digest('base64');
	const socket = { send: (text: string) => void stream.write(clientFrame(1, Buffer.from(text))) };
	return new Promise((resolve, reject) => {
		let buffer: Buffer = Buffer.alloc(0);
		let open = false;
		const fail = (message: string) => {
			stream.destroy();
			if (open) handlers.close();
			else reject(new ExpectedCliError(message));
		};
		stream.on('data', (chunk: Buffer) => {
			buffer = Buffer.concat([buffer, chunk]);
			if (!open) {
				const end = buffer.indexOf('\r\n\r\n');
				if (end < 0) {
					if (buffer.length > maxHandshake) fail('Bad DevTools reply.');
					return;
				}
				if (!accepted(buffer.subarray(0, end).toString(), accept)) {
					fail('DevTools refused the connection.');
					return;
				}
				buffer = buffer.subarray(end + 4);
				open = true;
				resolve(socket);
			}
			buffer = readFrames(buffer, stream, handlers, () => fail('DevTools closed.'));
		});
		stream.once('close', () => fail('The browser pipe closed.'));
		stream.once('error', () => fail('The browser pipe failed.'));
		stream.write(upgradeRequest(path, key));
	});
}

function upgradeRequest(path: string, key: string): string {
	return [
		`GET ${path} HTTP/1.1`,
		'Host: 127.0.0.1:9222',
		'Upgrade: websocket',
		'Connection: Upgrade',
		`Sec-WebSocket-Key: ${key}`,
		'Sec-WebSocket-Version: 13',
		'',
		''
	].join('\r\n');
}

function accepted(head: string, accept: string): boolean {
	return (
		/^HTTP\/1\.1 101 /u.test(head) &&
		head.split('\r\n').some((line) => {
			const [name, value] = line.split(': ');
			return name.toLowerCase() === 'sec-websocket-accept' && value === accept;
		})
	);
}
