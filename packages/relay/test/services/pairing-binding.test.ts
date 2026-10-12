import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	command,
	connectHost,
	newIdentity,
	newRequest,
	openPairing,
	pairingPath,
	registerHost,
	sealedText,
	type TestHost,
	type TestRequest
} from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';
import type { RelaySocket } from '../support/relaySocket';

let relay: RelayFixture;
let host: TestHost;
let socket: RelaySocket;

beforeAll(async () => {
	relay = await startRelay();
	host = await registerHost(relay);
	socket = await connectHost(relay, host);
}, 60_000);
afterAll(() => relay.stop());

/** Phones that ask for the same pairing one after the other; the host is told of each. */
async function asked(pairingId: string, count: number): Promise<TestRequest[]> {
	const requests: TestRequest[] = [];
	for (let index = 0; index < count; index++) {
		const request = await newRequest(pairingId);
		const posted = await relay.post(pairingPath(host, pairingId, 'request'), request.body);
		expect(posted.status).toBe(202);
		await socket.until('pairing-request');
		requests.push(request);
	}
	return requests;
}
/** The host approves the request with this challenge, for a new device. */
async function approve(pairingId: string, challenge: string) {
	const deviceId = (await newIdentity()).id;
	const body = { type: 'pairing-approve', pairingId, deviceId, sealed: sealedText(), challenge };
	return { deviceId, ack: await command(socket, body) };
}
const exchange = (pairingId: string, verifier: string) =>
	relay.post(pairingPath(host, pairingId, 'exchange'), { verifier });
const state = async (pairingId: string) =>
	((await (await relay.post(pairingPath(host, pairingId, 'poll'), {})).json()) as { state: string })
		.state;

test('an approval bound to a request that was since replaced approves nothing', async () => {
	const pairingId = await openPairing(socket);
	const [first, replacement] = await asked(pairingId, 2);
	const stale = await approve(pairingId, first.body.challenge);
	expect(stale.ack).toMatchObject({ ok: false, error: 'pairing-unavailable' });
	expect(await state(pairingId)).toBe('requested');
	expect((await exchange(pairingId, replacement.verifier)).status).not.toBe(200);
	expect((await exchange(pairingId, first.verifier)).status).not.toBe(200);
});

test('an approval bound to the latest request serves exactly that request, once', async () => {
	const pairingId = await openPairing(socket);
	const [, latest] = await asked(pairingId, 2);
	const approved = await approve(pairingId, latest.body.challenge);
	expect(approved.ack).toMatchObject({ ok: true });
	const exchanged = await exchange(pairingId, latest.verifier);
	expect(exchanged.status).toBe(200);
	expect(await exchanged.json()).toMatchObject({ deviceId: approved.deviceId });
	expect((await exchange(pairingId, latest.verifier)).status).not.toBe(200);
});

test('the verifier of a replaced request cannot use the approval of the latest one', async () => {
	const pairingId = await openPairing(socket);
	const [earlier, latest] = await asked(pairingId, 2);
	expect((await approve(pairingId, latest.body.challenge)).ack).toMatchObject({ ok: true });
	expect((await exchange(pairingId, earlier.verifier)).status).not.toBe(200);
});

test('after an approval no later request can take the place of the approved one', async () => {
	const pairingId = await openPairing(socket);
	const [first] = await asked(pairingId, 1);
	const approved = await approve(pairingId, first.body.challenge);
	expect(approved.ack).toMatchObject({ ok: true });
	const late = await newRequest(pairingId);
	const refused = await relay.post(pairingPath(host, pairingId, 'request'), late.body);
	expect(refused.status).toBe(409);
	expect(await state(pairingId)).toBe('approved');
	const exchanged = await exchange(pairingId, first.verifier);
	expect(exchanged.status).toBe(200);
	expect(await exchanged.json()).toMatchObject({ deviceId: approved.deviceId });
});

test('a well-formed challenge that no stored request carries approves nothing', async () => {
	const pairingId = await openPairing(socket);
	const [first] = await asked(pairingId, 1);
	const never = await newRequest(pairingId);
	expect((await approve(pairingId, never.body.challenge)).ack).toMatchObject({
		ok: false,
		error: 'pairing-unavailable'
	});
	expect(await state(pairingId)).toBe('requested');
	expect((await exchange(pairingId, first.verifier)).status).not.toBe(200);
});
