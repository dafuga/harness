import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	command,
	connectHost,
	newRequest,
	submitPairing,
	pairingPath,
	registerHost,
	sealedText,
	type TestHost
} from './support/relayActors';
import { randomId } from '../../remote/src/index';
import { startRelay, type RelayFixture } from './support/relayFixture';
import type { RelaySocket } from './support/relaySocket';

let relay: RelayFixture;
let host: TestHost;
let socket: RelaySocket;

beforeAll(async () => {
	relay = await startRelay();
	host = await registerHost(relay);
	socket = await connectHost(relay, host);
}, 60_000);
afterAll(() => relay.stop());

test('a replacement cannot take the place of an account request that is waiting', async () => {
	const pairingId = randomId();
	const first = await newRequest(pairingId);
	const replacement = await newRequest(pairingId);
	const path = pairingPath(host, pairingId);
	expect((await submitPairing(relay, host, first)).status).toBe(200);
	await socket.until('pairing-request');
	/* An account request is installed in one turn: a second one cannot take its place. */
	expect((await submitPairing(relay, host, replacement)).status).toBe(409);
	await command(socket, {
		type: 'pairing-approve',
		pairingId,
		deviceId: 'd4'.repeat(20),
		sealed: sealedText()
	});
	const exchanged = await relay.post(`${path}/exchange`, { verifier: replacement.verifier });
	expect(exchanged.status, 'unbound approval must not issue a device credential').not.toBe(200);
	const original = await relay.post(`${path}/exchange`, { verifier: first.verifier });
	expect(original.status).toBe(400);
});
