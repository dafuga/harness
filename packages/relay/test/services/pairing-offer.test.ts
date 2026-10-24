import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomId, remoteLimits } from '../../../remote/src/index';
import { relayConfig } from '../../src/configs/relayConfig';
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
const missing = [404, { error: 'not-found' }];
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

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pairingKeys(): Promise<string[]> {
	const rows = await relay.rows(host.hostId);
	return rows.map((row) => row.key).filter((key) => key.startsWith('pairing:'));
}

test('pairing-open is acknowledged by its ref and the offer becomes public', async () => {
	const pairingId = randomId();
	const expiresAt = new Date(Date.now() + 60_000).toISOString();
	socket.send({ type: 'pairing-open', ref: 'open-1', pairingId, expiresAt });
	expect(await socket.until('ack')).toEqual({ type: 'ack', ref: 'open-1', ok: true });
	const info = await relay.fetch(pairingPath(host, pairingId));
	expect(info.headers.get('Cache-Control')).toBe('no-store');
	expect(await answer(info)).toEqual([
		200,
		{ hostId: host.hostId, pairingId, hostKey: host.hostKey, state: 'open', expiresAt }
	]);
});

test('an offer never lives longer than five minutes', async () => {
	const before = Date.now();
	const pairingId = await openPairing(socket, 60 * 60_000);
	const info = (await (await relay.fetch(pairingPath(host, pairingId))).json()) as {
		expiresAt: string;
	};
	const end = Date.parse(info.expiresAt);
	expect(end).toBeGreaterThanOrEqual(before + remoteLimits.pairingTtlMs - 1000);
	expect(end).toBeLessThanOrEqual(Date.now() + remoteLimits.pairingTtlMs);
});

test('an offer needs an id that is not in use and an end in the future', async () => {
	const pairingId = await openPairing(socket);
	const later = new Date(Date.now() + 60_000).toISOString();
	const again = await command(socket, { type: 'pairing-open', pairingId, expiresAt: later });
	expect(again).toMatchObject({ ok: false, error: 'pairing-unavailable' });
	const past = new Date(Date.now() - 1000).toISOString();
	const stale = await command(socket, {
		type: 'pairing-open',
		pairingId: randomId(),
		expiresAt: past
	});
	expect(stale).toMatchObject({ ok: false, error: 'invalid-input' });
});

test('an offer can only be approved after a phone asked for it', async () => {
	const pairingId = await openPairing(socket);
	const approval = { type: 'pairing-approve', deviceId, sealed: sealedText() };
	expect(await command(socket, { ...approval, pairingId })).toMatchObject({
		ok: false,
		error: 'pairing-unavailable'
	});
	const unknown = randomId();
	expect(await command(socket, { ...approval, pairingId: unknown })).toMatchObject({
		ok: false,
		error: 'not-found'
	});
	expect(await command(socket, { type: 'pairing-deny', pairingId: unknown })).toMatchObject({
		ok: false,
		error: 'not-found'
	});
});

test('deny ends an offer and close removes it', async () => {
	const pairingId = await openPairing(socket);
	const request = await newRequest(pairingId);
	expect(await command(socket, { type: 'pairing-deny', pairingId })).toMatchObject({ ok: true });
	const poll = await relay.post(pairingPath(host, pairingId, 'poll'), {});
	expect(await poll.json()).toMatchObject({ state: 'denied' });
	const asked = await relay.post(pairingPath(host, pairingId, 'request'), request.body);
	expect(await answer(asked)).toEqual([409, { error: 'pairing-unavailable' }]);
	expect(await command(socket, { type: 'pairing-close', pairingId })).toMatchObject({ ok: true });
	expect(await answer(await relay.fetch(pairingPath(host, pairingId)))).toEqual(missing);
	expect(await command(socket, { type: 'pairing-close', pairingId })).toMatchObject({ ok: true });
});

test('an expired offer says so to a phone that polls, once, and is gone', async () => {
	const pairingId = await openPairing(socket, 400);
	const open = (await (await relay.fetch(pairingPath(host, pairingId))).json()) as {
		expiresAt: string;
	};
	await wait(600);
	const poll = await relay.post(pairingPath(host, pairingId, 'poll'), {});
	expect(await answer(poll)).toEqual([200, { state: 'expired', expiresAt: open.expiresAt }]);
	expect(await answer(await relay.post(pairingPath(host, pairingId, 'poll'), {}))).toEqual(missing);
	expect(await pairingKeys()).not.toContain(`pairing:${pairingId}`);
});

test('an expired offer is not found by a phone that asks for it', async () => {
	const pairingId = await openPairing(socket, 300);
	const request = await newRequest(pairingId);
	await wait(500);
	const asked = await relay.post(pairingPath(host, pairingId, 'request'), request.body);
	expect(await answer(asked)).toEqual(missing);
	expect(await answer(await relay.fetch(pairingPath(host, pairingId)))).toEqual(missing);
	expect(await socket.drain()).toEqual([]);
	expect(await pairingKeys()).not.toContain(`pairing:${pairingId}`);
});

test('the alarm deletes an expired offer nobody came back for', async () => {
	const pairingId = await openPairing(socket, 300);
	expect(await pairingKeys()).toContain(`pairing:${pairingId}`);
	await wait(300 + relayConfig.sweepDelayMs + 1200);
	expect(await pairingKeys()).not.toContain(`pairing:${pairingId}`);
}, 15_000);

test('a host holds a bounded number of offers at a time', async () => {
	const crowded = await registerHost(relay);
	const own = await connectHost(relay, crowded);
	const offers: string[] = [];
	for (let index = 0; index < relayConfig.openPairings; index += 1)
		offers.push(await openPairing(own));
	const later = new Date(Date.now() + 60_000).toISOString();
	const refused = await command(own, {
		type: 'pairing-open',
		pairingId: randomId(),
		expiresAt: later
	});
	expect(refused).toMatchObject({ ok: false, error: 'rate-limited' });
	expect(await command(own, { type: 'pairing-close', pairingId: offers[0] })).toMatchObject({
		ok: true
	});
	await openPairing(own);
	own.close();
});
