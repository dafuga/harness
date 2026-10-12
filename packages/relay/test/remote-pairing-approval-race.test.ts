import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	command,
	connectHost,
	newRequest,
	openPairing,
	pairingPath,
	registerHost,
	sealedText,
	type TestHost
} from './support/relayActors';
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

test('a replacement cannot exchange an approval for an earlier unbound request', async () => {
	const pairingId = await openPairing(socket);
	const first = await newRequest(pairingId);
	const replacement = await newRequest(pairingId);
	const path = pairingPath(host, pairingId);
	expect((await relay.post(`${path}/request`, first.body)).status).toBe(202);
	await socket.until('pairing-request');
	expect((await relay.post(`${path}/request`, replacement.body)).status).toBe(202);
	await socket.until('pairing-request');
	await command(socket, {
		type: 'pairing-approve',
		pairingId,
		deviceId: 'd4'.repeat(20),
		sealed: sealedText()
	});
	const exchanged = await relay.post(`${path}/exchange`, { verifier: replacement.verifier });
	expect(exchanged.status, 'unbound approval must not issue a device credential').not.toBe(200);
});
