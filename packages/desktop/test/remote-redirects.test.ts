import { expect } from '../../../test/verificationExpect';
import { afterEach, test } from 'vitest';
import { createServer } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { DevicePairingService } from '../../remote/src/index';
import { RelaySocketAdapter } from '../src/adapters/RelaySocketAdapter';
import { RemoteRegistrationAdapter } from '../src/adapters/RemoteRegistrationAdapter';

interface Answer {
	status: number;
	location?: string;
	body?: string;
}
const servers: Server[] = [];
afterEach(async () => {
	await Promise.all(
		servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve)))
	);
});
const noted = (request: IncomingMessage) => ({
	method: request.method ?? '',
	path: request.url ?? '',
	authorization: request.headers.authorization ?? null
});
/** A real server on this machine that records what reaches it and answers as told. */
async function recorder(answer: (request: IncomingMessage) => Answer = () => ({ status: 200 })) {
	const seen: ReturnType<typeof noted>[] = [];
	const head = ({ location }: Answer) => (location ? { location } : {});
	const server = createServer((request, response) => {
		const reply = answer(request);
		seen.push(noted(request));
		response.writeHead(reply.status, { 'content-type': 'application/json', ...head(reply) });
		response.end(reply.body ?? '{}');
	});
	server.on('upgrade', (request, socket) => {
		const reply = answer(request),
			location = reply.location ? `Location: ${reply.location}\r\n` : '';
		seen.push(noted(request));
		socket.end(`HTTP/1.1 ${reply.status} Redirect\r\n${location}Connection: close\r\n\r\n`);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	servers.push(server);
	const { port } = server.address() as AddressInfo;
	return { origin: `http://127.0.0.1:${port}`, socketOrigin: `ws://127.0.0.1:${port}`, seen };
}
const redirects = [301, 302, 303, 307, 308],
	token = 'n'.repeat(43),
	hostId = 'a'.repeat(40),
	input = { hostId, hostKey: 'K'.repeat(87), credentialHash: 'c'.repeat(64), name: 'Fixture Mac' },
	actor = { id: 'google:fixture-one', email: 'o@gmail.com', name: 'O', emailVerified: true },
	status = JSON.stringify({ actor, configured: true, clientId: 'client' });

test('host registration follows no redirect, and the hosted session reaches no other origin', async () => {
	for (const code of redirects) {
		const elsewhere = await recorder(),
			location = elsewhere.origin + '/api/remote/hosts';
		const hub = await recorder((request) =>
			request.url === '/api/auth/status'
				? { status: 200, body: status }
				: { status: code, location }
		);
		const credentials = async () => ({ origin: hub.origin, principalId: actor.id, token }),
			adapter = new RemoteRegistrationAdapter({ origin: hub.origin, credentials });
		await expect(adapter.register(input)).rejects.toThrow();
		expect(elsewhere.seen).toEqual([]);
		expect(hub.seen.map((request) => [request.method, request.authorization])).toEqual([
			['GET', 'Bearer ' + token],
			['POST', 'Bearer ' + token]
		]);
	}
}, 30000);

test('a redirected session check is not followed either: the host stays signed out', async () => {
	const elsewhere = await recorder(() => ({ status: 200, body: status })),
		hub = await recorder(() => ({ status: 307, location: elsewhere.origin + '/api/auth/status' })),
		credentials = async () => ({ origin: hub.origin, principalId: actor.id, token }),
		adapter = new RemoteRegistrationAdapter({ origin: hub.origin, credentials });
	await expect(adapter.register(input)).rejects.toMatchObject({ signedOut: true });
	expect(elsewhere.seen).toEqual([]);
	expect(hub.seen).toHaveLength(1);
}, 30000);

test('the socket of a host follows no redirect on its upgrade, and its credential stays put', async () => {
	const headers = { Authorization: 'Bearer ' + token, 'X-Harness-Role': 'host' },
		path = `/v1/hosts/${hostId}/connect`;
	for (const code of redirects) {
		const elsewhere = await recorder(),
			relay = await recorder(() => ({ status: code, location: elsewhere.socketOrigin + path })),
			socket = new RelaySocketAdapter().open(relay.socketOrigin + path, headers),
			codes: number[] = [];
		socket.onClose((closed) => codes.push(closed));
		await expect(socket.opened).rejects.toThrow('relay');
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(elsewhere.seen).toEqual([]);
		expect(relay.seen).toEqual([{ method: 'GET', path, authorization: 'Bearer ' + token }]);
	}
}, 30000);

test('the pairing calls of a phone follow no redirect', async () => {
	for (const code of [307, 308]) {
		const elsewhere = await recorder(),
			relay = await recorder(() => ({ status: code, location: elsewhere.origin + '/v1/health' })),
			request = { origin: relay.origin, hostId, pairingId: 'b'.repeat(32) },
			phone = { ...request, code: 'ABCD-EFGH', deviceName: 'Fixture phone' };
		await expect(new DevicePairingService().request(phone)).rejects.toThrow();
		expect(elsewhere.seen).toEqual([]);
		expect(relay.seen).toHaveLength(1);
	}
}, 30000);
