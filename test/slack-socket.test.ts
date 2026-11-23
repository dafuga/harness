import { once } from 'node:events';
import { expect, test } from 'vitest';
import { WebSocketServer } from 'ws';
import { openSlackSocket } from '../src/adapters/agents-providers/slack-adapter/openSlackSocket';

test('transports individual Socket Mode frames and acknowledgments and closes on abort', async () => {
	const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
	await once(server, 'listening');
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Expected an ephemeral port.');
	const controller = new AbortController();
	const connected = once(server, 'connection');
	const connection = openSlackSocket(
		new URL('ws://127.0.0.1:' + address.port + '/link/'),
		controller.signal
	);
	try {
		const [peer] = await connected;
		peer.send('first');
		peer.send('second');

		const frames = connection.frames[Symbol.asyncIterator]();
		expect(String((await frames.next()).value)).toBe('first');
		expect(String((await frames.next()).value)).toBe('second');
		const acknowledgment = once(peer, 'message');
		await connection.ack('env-123');
		expect(String((await acknowledgment)[0])).toBe('{"envelope_id":"env-123"}');

		const disconnected = once(peer, 'close');
		controller.abort();
		await disconnected;
		expect((await frames.next()).done).toBe(true);
	} finally {
		connection.close();
		for (const peer of server.clients) peer.terminate();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
