import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomId } from '../../../remote/src/index';
import {
	command,
	connectHost,
	newIdentity,
	newRequest,
	pairingPath,
	registerHost,
	sealedText,
	submitPairing,
	type TestHost,
	type TestRequest
} from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';
import type { RelaySocket } from '../support/relaySocket';

let relay: RelayFixture;
beforeAll(async () => {
	relay = await startRelay();
}, 60_000);
afterAll(() => relay.stop());

interface Own {
	host: TestHost;
	socket: RelaySocket;
	request: TestRequest;
}

/** A host of its own with one waiting account request; the host is told of it. */
async function waiting(): Promise<Own> {
	const host = await registerHost(relay);
	const socket = await connectHost(relay, host);
	const request = await newRequest(randomId());
	expect((await submitPairing(relay, host, request)).status).toBe(200);
	await socket.until('pairing-request');
	return { host, socket, request };
}
/** The host approves the request with this challenge, for a new device. */
async function approve(own: Own, challenge: string) {
	const deviceId = (await newIdentity()).id;
	const { pairingId } = own.request;
	const body = { type: 'pairing-approve', pairingId, deviceId, sealed: sealedText(), challenge };
	return { deviceId, ack: await command(own.socket, body) };
}
const exchange = (own: Own, verifier: string) =>
	relay.post(pairingPath(own.host, own.request.pairingId, 'exchange'), { verifier });
const state = async (own: Own) =>
	(
		(await (await relay.post(pairingPath(own.host, own.request.pairingId, 'poll'), {})).json()) as {
			state: string;
		}
	).state;

test('an approval bound to a request that is not this one approves nothing', async () => {
	const own = await waiting();
	const stale = await approve(own, (await newRequest(own.request.pairingId)).body.challenge);
	expect(stale.ack).toMatchObject({ ok: false, error: 'pairing-unavailable' });
	expect(await state(own)).toBe('requested');
	expect((await exchange(own, own.request.verifier)).status).not.toBe(200);
});

test('an approval bound to the request serves exactly that request, once', async () => {
	const own = await waiting();
	const approved = await approve(own, own.request.body.challenge);
	expect(approved.ack).toMatchObject({ ok: true });
	const exchanged = await exchange(own, own.request.verifier);
	expect(exchanged.status).toBe(200);
	expect(await exchanged.json()).toMatchObject({ deviceId: approved.deviceId });
	expect((await exchange(own, own.request.verifier)).status).not.toBe(200);
});

test('another verifier cannot use the approval of the request', async () => {
	const own = await waiting();
	expect((await approve(own, own.request.body.challenge)).ack).toMatchObject({ ok: true });
	expect((await exchange(own, (await newRequest(own.request.pairingId)).verifier)).status).not.toBe(
		200
	);
});

test('after an approval no later request can take the place of the approved one', async () => {
	const own = await waiting();
	const approved = await approve(own, own.request.body.challenge);
	expect(approved.ack).toMatchObject({ ok: true });
	const late = await newRequest(own.request.pairingId);
	expect((await submitPairing(relay, own.host, late)).status).toBe(409);
	expect(await state(own)).toBe('approved');
	const exchanged = await exchange(own, own.request.verifier);
	expect(exchanged.status).toBe(200);
	expect(await exchanged.json()).toMatchObject({ deviceId: approved.deviceId });
});
