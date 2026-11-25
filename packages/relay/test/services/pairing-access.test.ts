import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomId } from '../../../remote/src/index';
import {
	command,
	connectHost,
	newRequest,
	pairingPath,
	registerHost,
	sealedText,
	submitPairing,
	type TestHost
} from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';
import type { RelaySocket } from '../support/relaySocket';

const deviceId = 'd4'.repeat(20);
const unavailable = [409, { error: 'pairing-unavailable' }];
let relay: RelayFixture;

beforeAll(async () => {
	relay = await startRelay();
}, 60_000);
afterAll(() => relay.stop());

async function answer(response: Response): Promise<[number, unknown]> {
	return [response.status, await response.json()];
}

async function poll(target: TestHost, pairingId: string): Promise<unknown> {
	const response = await relay.post(pairingPath(target, pairingId, 'poll'), {});
	return ((await response.json()) as { state?: unknown }).state;
}

/** A host of its own, so that one waiting account request never stands in another's way. */
async function own(): Promise<{ host: TestHost; socket: RelaySocket }> {
	const host = await registerHost(relay);
	return { host, socket: await connectHost(relay, host) };
}

const frame = (pairingId: string, body: Record<string, string>) => ({
	type: 'pairing-request',
	pairingId,
	account: true,
	expiresAt: expect.any(String),
	...body
});

test('an account request is kept, forwarded to the host and reported to the phone', async () => {
	const { host, socket } = await own();
	const request = await newRequest(randomId());
	const asked = await submitPairing(relay, host, request);
	expect(asked.headers.get('Cache-Control')).toBe('no-store');
	expect(await asked.json()).toEqual({ state: 'requested', expiresAt: expect.any(String) });
	expect(await socket.next()).toEqual(frame(request.pairingId, request.body));
	expect(await poll(host, request.pairingId)).toBe('requested');
	socket.close();
});

test('a host holds one waiting account request at a time, and public requests do not exist', async () => {
	const { host, socket } = await own();
	const first = await newRequest(randomId());
	expect((await submitPairing(relay, host, first)).status).toBe(200);
	const second = await newRequest(randomId());
	expect(await answer(await submitPairing(relay, host, second))).toEqual(unavailable);
	const direct = await relay.post(pairingPath(host, second.pairingId, 'request'), second.body);
	expect(direct.status).toBe(404);
	expect((await relay.fetch(pairingPath(host, first.pairingId))).status).toBe(404);
	socket.close();
});

test('a request for a host that is away is refused and nothing is kept', async () => {
	const { host, socket } = await own();
	socket.close();
	await socket.closed;
	const request = await newRequest(randomId());
	expect(await answer(await submitPairing(relay, host, request))).toEqual(unavailable);
	expect(await poll(host, request.pairingId)).toBeUndefined();
	const back = await connectHost(relay, host);
	expect(await back.drain()).toEqual([]);
	back.close();
});

test('no request is accepted once the host decided', async () => {
	const { host, socket } = await own();
	const asked = await newRequest(randomId()),
		{ challenge } = asked.body;
	expect((await submitPairing(relay, host, asked)).status).toBe(200);
	const approval = {
		type: 'pairing-approve',
		pairingId: asked.pairingId,
		deviceId,
		sealed: sealedText(),
		challenge
	};
	expect(await command(socket, approval)).toMatchObject({ ok: true });
	expect(await answer(await submitPairing(relay, host, asked))).toEqual(unavailable);
	expect(await poll(host, asked.pairingId)).toBe('approved');
	const denied = await newRequest(randomId());
	expect((await submitPairing(relay, host, denied)).status).toBe(200);
	const deny = { type: 'pairing-deny', pairingId: denied.pairingId };
	expect(await command(socket, deny)).toMatchObject({ ok: true });
	expect(await answer(await submitPairing(relay, host, denied))).toEqual(unavailable);
	expect(await poll(host, denied.pairingId)).toBe('denied');
	socket.close();
});

test('an approval is given once and cannot be replaced', async () => {
	const { host, socket } = await own();
	const request = await newRequest(randomId());
	await submitPairing(relay, host, request);
	const { pairingId } = request,
		{ challenge } = request.body,
		approval = { type: 'pairing-approve', pairingId, deviceId, sealed: sealedText(), challenge };
	expect(await command(socket, approval)).toMatchObject({ ok: true });
	const other = { ...approval, deviceId: 'e5'.repeat(20), sealed: sealedText() };
	expect(await command(socket, other)).toMatchObject({ ok: false, error: 'pairing-unavailable' });
	expect(await command(socket, { type: 'pairing-deny', pairingId })).toMatchObject({
		ok: false,
		error: 'pairing-unavailable'
	});
	expect(await poll(host, pairingId)).toBe('approved');
	socket.close();
});

test('poll follows an account request through its states', async () => {
	const { host, socket } = await own();
	const asked = await newRequest(randomId()),
		{ pairingId } = asked,
		{ challenge } = asked.body;
	await submitPairing(relay, host, asked);
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
	socket.close();
});
