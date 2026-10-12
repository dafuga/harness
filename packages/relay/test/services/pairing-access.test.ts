import { afterAll, beforeAll, expect, test } from 'vitest';
import { remoteLimits } from '../../../remote/src/index';
import {
	command,
	connectHost,
	newRequest,
	openPairing,
	pairingPath,
	registerHost,
	sealedText,
	type TestHost
} from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';
import type { RelaySocket } from '../support/relaySocket';

const deviceId = 'd4'.repeat(20);
const unavailable = [409, { error: 'pairing-unavailable' }];
let relay: RelayFixture;
let host: TestHost;
let socket: RelaySocket;

beforeAll(async () => {
	relay = await startRelay();
	host = await registerHost(relay);
	socket = await connectHost(relay, host);
}, 60_000);
afterAll(() => relay.stop());

async function answer(response: Response): Promise<[number, unknown]> {
	return [response.status, await response.json()];
}

async function poll(target: TestHost, pairingId: string): Promise<unknown> {
	const response = await relay.post(pairingPath(target, pairingId, 'poll'), {});
	return ((await response.json()) as { state?: unknown }).state;
}

test('a request is kept, forwarded to the host and reported to the phone', async () => {
	const pairingId = await openPairing(socket);
	const info = (await (await relay.fetch(pairingPath(host, pairingId))).json()) as {
		expiresAt: string;
	};
	const request = await newRequest(pairingId);
	const asked = await relay.post(pairingPath(host, pairingId, 'request'), request.body);
	expect(asked.headers.get('Cache-Control')).toBe('no-store');
	expect(await answer(asked)).toEqual([202, { state: 'requested', expiresAt: info.expiresAt }]);
	expect(await socket.next()).toEqual({ type: 'pairing-request', pairingId, ...request.body });
	const polled = await relay.post(pairingPath(host, pairingId, 'poll'), {});
	expect(await answer(polled)).toEqual([200, { state: 'requested', expiresAt: info.expiresAt }]);
	const after = await relay.fetch(pairingPath(host, pairingId));
	expect(await after.json()).toMatchObject({ state: 'requested', hostKey: host.hostKey });
});

test('the newest request replaces the one before, five times at most', async () => {
	const own = await registerHost(relay);
	const first = await connectHost(relay, own);
	const pairingId = await openPairing(first);
	const path = pairingPath(own, pairingId, 'request');
	const bodies: Record<string, string>[] = [];
	for (let attempt = 0; attempt < remoteLimits.pairingAttempts; attempt += 1) {
		const request = await newRequest(pairingId);
		bodies.push(request.body);
		expect((await relay.post(path, request.body)).status).toBe(202);
		expect(await first.next()).toEqual({ type: 'pairing-request', pairingId, ...request.body });
	}
	const extra = await newRequest(pairingId);
	expect(await answer(await relay.post(path, extra.body))).toEqual(unavailable);
	expect(await first.drain()).toEqual([]);
	expect(await poll(own, pairingId)).toBe('requested');
	const second = await connectHost(relay, own);
	expect(await second.drain()).toEqual([
		{ type: 'pairing-request', pairingId, ...bodies[bodies.length - 1] }
	]);
	second.close();
});

test('a request waits for a host that is away', async () => {
	const own = await registerHost(relay);
	const first = await connectHost(relay, own);
	const pairingId = await openPairing(first);
	first.close();
	await first.closed;
	const request = await newRequest(pairingId);
	const asked = await relay.post(pairingPath(own, pairingId, 'request'), request.body);
	expect(asked.status).toBe(202);
	const second = await connectHost(relay, own);
	expect(await second.next()).toEqual({ type: 'pairing-request', pairingId, ...request.body });
	second.close();
});

test('no request is accepted once the host decided', async () => {
	const approved = await openPairing(socket);
	const path = pairingPath(host, approved, 'request');
	const asked = await newRequest(approved),
		{ challenge } = asked.body;
	expect((await relay.post(path, asked.body)).status).toBe(202);
	const approval = {
		type: 'pairing-approve',
		pairingId: approved,
		deviceId,
		sealed: sealedText(),
		challenge
	};
	expect(await command(socket, approval)).toMatchObject({ ok: true });
	expect(await answer(await relay.post(path, (await newRequest(approved)).body))).toEqual(
		unavailable
	);
	expect(await poll(host, approved)).toBe('approved');
	const denied = await openPairing(socket);
	expect(await command(socket, { type: 'pairing-deny', pairingId: denied })).toMatchObject({
		ok: true
	});
	const late = await relay.post(
		pairingPath(host, denied, 'request'),
		(await newRequest(denied)).body
	);
	expect(await answer(late)).toEqual(unavailable);
	expect(await poll(host, denied)).toBe('denied');
});

test('an approval is given once and cannot be replaced', async () => {
	const pairingId = await openPairing(socket);
	const request = await newRequest(pairingId);
	await relay.post(pairingPath(host, pairingId, 'request'), request.body);
	const { challenge } = request.body,
		approval = { type: 'pairing-approve', pairingId, deviceId, sealed: sealedText(), challenge };
	expect(await command(socket, approval)).toMatchObject({ ok: true });
	const other = { ...approval, deviceId: 'e5'.repeat(20), sealed: sealedText() };
	expect(await command(socket, other)).toMatchObject({ ok: false, error: 'pairing-unavailable' });
	expect(await command(socket, { type: 'pairing-deny', pairingId })).toMatchObject({
		ok: false,
		error: 'pairing-unavailable'
	});
	expect(await poll(host, pairingId)).toBe('approved');
});

test('poll follows an offer through its states', async () => {
	const pairingId = await openPairing(socket);
	expect(await poll(host, pairingId)).toBe('open');
	const asked = await newRequest(pairingId),
		{ challenge } = asked.body;
	await relay.post(pairingPath(host, pairingId, 'request'), asked.body);
	expect(await poll(host, pairingId)).toBe('requested');
	const approval = {
		type: 'pairing-approve',
		pairingId,
		deviceId,
		sealed: sealedText(),
		challenge
	};
	await command(socket, approval);
	expect(await poll(host, pairingId)).toBe('approved');
	const unknown = await relay.post(pairingPath(host, 'f7'.repeat(16), 'poll'), {});
	expect(await answer(unknown)).toEqual([404, { error: 'not-found' }]);
});
