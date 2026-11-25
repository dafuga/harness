import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomId } from '../../../remote/src/index';
import { relayConfig } from '../../src/configs/networking-security/relayConfig';
import {
	connectHost,
	newHost,
	newRequest,
	ownerOf,
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

test('a poll body must be a JSON object that says it is JSON', async () => {
	const path = pairingPath(host, randomId(), 'poll');
	expect(await answer(await send(path, '{}', 'text/plain'))).toEqual(invalid);
	for (const malformed of ['', '[]', 'null', '"text"', '{']) {
		expect(await answer(await send(path, malformed)), malformed).toEqual(invalid);
	}
	expect(await socket.drain()).toEqual([]);
});

test('a poll body over 16 KiB is refused', async () => {
	const path = pairingPath(host, randomId(), 'poll');
	const fits = '{}' + ' '.repeat(relayConfig.bodyBytes - 2);
	expect(await answer(await send(path, `${fits} `))).toEqual(invalid);
	expect(await answer(await send(path, '{}' + ' '.repeat(4 * relayConfig.bodyBytes)))).toEqual(
		invalid
	);
});

test('the fields of an account pairing request are validated strictly', async () => {
	const pairingId = randomId();
	const request = await newRequest(pairingId);
	const changes: Record<string, unknown>[] = [
		{ challenge: undefined },
		{ challenge: request.body.challenge.slice(2) },
		{ ephemeralKey: request.body.challenge },
		{ sealed: '' },
		{ sealed: 'not base64url!' },
		{ deviceId: 'd4'.repeat(20) }
	];
	for (const change of changes) {
		const body = { ...ownerOf(host), pairingId, request: { ...request.body, ...change } };
		const response = await relay.manage('pairing-request', body);
		expect(await answer(response), JSON.stringify(change)).toEqual(invalid);
	}
	expect(await state(pairingId)).toBeUndefined();
	expect(await socket.drain()).toEqual([]);
});

test('an exchange with a malformed body is invalid like any other failed exchange', async () => {
	const path = pairingPath(host, randomId(), 'exchange');
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
	expect(await answer(await relay.post(pairingPath(unknown, pairingId, 'poll'), {}))).toEqual(
		missing
	);
	const asked = await relay.manage('pairing-request', {
		...ownerOf(unknown),
		pairingId,
		request: request.body
	});
	expect(await answer(asked)).toEqual(missing);
	expect(await relay.rows(unknown.hostId)).toEqual([]);
});

test('public pairing calls are limited per host and window', async () => {
	const busy = await registerHost(relay);
	const calm = await registerHost(relay);
	const path = pairingPath(busy, randomId());
	const statuses = new Set<number>();
	for (let call = 0; call < relayConfig.pairingCalls; call += 1) {
		statuses.add((await relay.post(`${path}/poll`, {})).status);
	}
	expect([...statuses]).toEqual([404]);
	const limited = [429, { error: 'rate-limited' }];
	expect(await answer(await relay.post(`${path}/poll`, {}))).toEqual(limited);
	expect(await answer(await relay.post(`${path}/exchange`, { verifier: 'x' }))).toEqual(limited);
	expect((await relay.post(pairingPath(calm, randomId(), 'poll'), {})).status).toBe(404);
});
