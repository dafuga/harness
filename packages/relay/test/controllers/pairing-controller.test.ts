import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomId } from '../../../remote/src/index';
import { relayConfig } from '../../src/configs/relayConfig';
import {
	connectHost,
	newHost,
	newRequest,
	openPairing,
	pairingPath,
	registerHost,
	type TestHost
} from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';
import type { RelaySocket } from '../support/relaySocket';

const invalid = [400, { error: 'invalid-input' }];
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

function send(path: string, body: string, type = 'application/json'): Promise<Response> {
	return relay.fetch(path, { method: 'POST', headers: { 'Content-Type': type }, body });
}

async function state(pairingId: string): Promise<unknown> {
	const response = await relay.post(pairingPath(host, pairingId, 'poll'), {});
	return ((await response.json()) as { state?: unknown }).state;
}

test('a pairing body must be a JSON object that says it is JSON', async () => {
	const pairingId = await openPairing(socket);
	const request = await newRequest(pairingId);
	const path = pairingPath(host, pairingId, 'request');
	const body = JSON.stringify(request.body);
	expect(await answer(await send(path, body, 'text/plain'))).toEqual(invalid);
	expect(await answer(await send(path, body, 'application/x-www-form-urlencoded'))).toEqual(
		invalid
	);
	for (const malformed of ['', '[]', 'null', '"text"', '{', `[${body}]`]) {
		expect(await answer(await send(path, malformed)), malformed).toEqual(invalid);
	}
	expect(await answer(await send(pairingPath(host, pairingId, 'poll'), '[]'))).toEqual(invalid);
	expect(await state(pairingId)).toBe('open');
	expect(await socket.drain()).toEqual([]);
});

test('a pairing body over 16 KiB is refused', async () => {
	const pairingId = await openPairing(socket);
	const request = await newRequest(pairingId);
	const path = pairingPath(host, pairingId, 'request');
	const body = JSON.stringify(request.body);
	const fits = body + ' '.repeat(relayConfig.bodyBytes - body.length);
	expect(await answer(await send(path, `${fits} `))).toEqual(invalid);
	expect(await answer(await send(path, body + ' '.repeat(4 * relayConfig.bodyBytes)))).toEqual(
		invalid
	);
	expect(await state(pairingId)).toBe('open');
	expect((await send(path, fits)).status).toBe(202);
});

test('the fields of a pairing request are validated strictly', async () => {
	const pairingId = await openPairing(socket);
	const request = await newRequest(pairingId);
	const path = pairingPath(host, pairingId, 'request');
	const changes: Record<string, unknown>[] = [
		{ challenge: undefined },
		{ challenge: request.body.challenge.slice(2) },
		{ ephemeralKey: request.body.challenge },
		{ sealed: '' },
		{ sealed: 'not base64url!' },
		{ deviceId: 'd4'.repeat(20) }
	];
	for (const change of changes) {
		const response = await relay.post(path, { ...request.body, ...change });
		expect(await answer(response), JSON.stringify(change)).toEqual(invalid);
	}
	expect(await state(pairingId)).toBe('open');
	expect(await socket.drain()).toEqual([]);
});

test('an exchange with a malformed body is invalid like any other failed exchange', async () => {
	const pairingId = await openPairing(socket);
	const path = pairingPath(host, pairingId, 'exchange');
	const failed = [400, { error: 'pairing-invalid' }];
	expect(await answer(await send(path, '{"verifier":"x"}', 'text/plain'))).toEqual(failed);
	expect(await answer(await send(path, '['))).toEqual(failed);
	expect(await answer(await relay.post(path, { verifier: 'short' }))).toEqual(failed);
});

test('a pairing of an unknown host is not found and stores nothing', async () => {
	const unknown = await newHost();
	const pairingId = randomId();
	const request = await newRequest(pairingId);
	const missing = [404, { error: 'not-found' }];
	expect(await answer(await relay.fetch(pairingPath(unknown, pairingId)))).toEqual(missing);
	expect(await answer(await relay.post(pairingPath(unknown, pairingId, 'poll'), {}))).toEqual(
		missing
	);
	const asked = await relay.post(pairingPath(unknown, pairingId, 'request'), request.body);
	expect(await answer(asked)).toEqual(missing);
	expect(await relay.rows(unknown.hostId)).toEqual([]);
	expect(await answer(await relay.fetch(pairingPath(host, pairingId)))).toEqual(missing);
});

test('public pairing calls are limited per host and window', async () => {
	const busy = await registerHost(relay);
	const calm = await registerHost(relay);
	const path = pairingPath(busy, randomId());
	const statuses = new Set<number>();
	for (let call = 0; call < relayConfig.pairingCalls; call += 1) {
		statuses.add((await relay.fetch(path)).status);
	}
	expect([...statuses]).toEqual([404]);
	const limited = [429, { error: 'rate-limited' }];
	expect(await answer(await relay.fetch(path))).toEqual(limited);
	expect(await answer(await relay.post(`${path}/poll`, {}))).toEqual(limited);
	expect(await answer(await relay.post(`${path}/exchange`, { verifier: 'x' }))).toEqual(limited);
	expect((await relay.fetch(pairingPath(calm, randomId()))).status).toBe(404);
});
