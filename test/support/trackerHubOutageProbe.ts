// Runs under Bun: asks a spoke for a due permit through the real transport, once per hub failure.
import { createServer, type Server, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';
import type { TrackerPersistenceService } from '../../src/services/projects-sessions/TrackerPersistenceService';
import { spokeAutomaticPermit } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerHubPermits';
import { trackerUpstreamLink } from '../../src/services/projects-sessions/tracker-node-service/trackerUpstreamLink';

const servers: Server[] = [];
const sockets: Socket[] = [];

async function hub(onConnection: (socket: Socket) => void) {
	const server = createServer((socket) => {
		sockets.push(socket);
		onConnection(socket);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	servers.push(server);
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const replying = (reply: string) => hub((socket) => socket.once('data', () => socket.end(reply)));

async function closedPort() {
	const url = await hub(() => {});
	await new Promise((resolve) => servers.pop()!.close(resolve));
	return url;
}

const hubs = {
	refused: await closedPort(),
	unresolved: 'https://tracker-hub.invalid',
	dropped: await hub((socket) => socket.once('data', () => socket.destroy())),
	silent: await hub(() => {}),
	gateway: await replying('HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n'),
	unauthorized: await replying('HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n'),
	redirected: await replying('HTTP/1.1 302 Found\r\nLocation: /login\r\nContent-Length: 0\r\n\r\n'),
	garbled: await replying('not an HTTP reply\r\n\r\n')
};

const startsAlone: Record<string, boolean> = {};
for (const [name, url] of Object.entries(hubs)) {
	const permit = spokeAutomaticPermit(
		{ node: 'spoke' } as TrackerPersistenceService,
		{
			node: 'spoke',
			role: 'spoke',
			links: [trackerUpstreamLink({ url }, 'probe-secret-'.repeat(4), 'hub', false)]
		},
		() => true
	)!;
	startsAlone[name] = await permit('probe00001', 'token', new AbortController().signal, 'due');
}
for (const socket of sockets) socket.destroy();
for (const server of servers) server.close();
console.log(JSON.stringify(startsAlone));
