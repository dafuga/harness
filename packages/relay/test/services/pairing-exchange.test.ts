import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomCredential, remotePatterns } from '../../../remote/src/index';
import {
	command,
	connectDevice,
	connectHost,
	connectUrl,
	deviceHeaders,
	newIdentity,
	ownerOf,
	pairDevice,
	pairingPath,
	registerHost,
	requestPairing,
	sealedText,
	type TestHost,
	type TestRequest
} from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';
import { RelaySocket } from '../support/relaySocket';

const failed = [400, { error: 'pairing-invalid' }];
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

function exchange(request: TestRequest, verifier = request.verifier): Promise<Response> {
	return relay.post(pairingPath(host, request.pairingId, 'exchange'), { verifier });
}

/** A request the host approved for a new device. */
async function approved(
	ttlMs?: number
): Promise<TestRequest & { deviceId: string; sealed: string }> {
	const request = await requestPairing(relay, host, socket, ttlMs);
	const approval = { deviceId: (await newIdentity()).id, sealed: sealedText() };
	const ack = await command(socket, {
		type: 'pairing-approve',
		pairingId: request.pairingId,
		challenge: request.body.challenge,
		...approval
	});
	expect(ack).toMatchObject({ ok: true });
	return { ...request, ...approval };
}

async function deviceCount(): Promise<number> {
	const summary = await relay.manage('summary', ownerOf(host));
	return ((await summary.json()) as { devices: unknown[] }).devices.length;
}

test('the exchange returns the credential and the approval exactly once', async () => {
	const pairing = await approved();
	const response = await relay.profile(
		{ units: ['relay.service.pairing-exchange'], workload: 'exchange-local-approved-pairing' },
		() => exchange(pairing)
	);
	expect(response.headers.get('Cache-Control')).toBe('no-store');
	const body = (await response.json()) as { deviceId: string; credential: string; sealed: string };
	expect(response.status).toBe(200);
	expect(body).toEqual({
		deviceId: pairing.deviceId,
		credential: body.credential,
		sealed: pairing.sealed
	});
	expect(body.credential).toMatch(remotePatterns.credential);
	expect(await answer(await exchange(pairing))).toEqual(failed);
	expect((await relay.fetch(pairingPath(host, pairing.pairingId))).status).toBe(404);
	const device = await connectDevice(relay, host, body);
	expect(await socket.until('device-open')).toMatchObject({ deviceId: pairing.deviceId });
	device.close();
});

test('a wrong verifier fails and uses the pairing up', async () => {
	const before = await deviceCount();
	const pairing = await approved();
	expect(await answer(await exchange(pairing, randomCredential()))).toEqual(failed);
	expect(await answer(await exchange(pairing))).toEqual(failed);
	expect((await relay.post(pairingPath(host, pairing.pairingId, 'poll'), {})).status).toBe(404);
	expect(await deviceCount()).toBe(before);
});

test('an exchange before the approval fails and uses the pairing up', async () => {
	const request = await requestPairing(relay, host, socket);
	expect(await answer(await exchange(request))).toEqual(failed);
	const approval = {
		pairingId: request.pairingId,
		deviceId: (await newIdentity()).id,
		sealed: sealedText()
	};
	expect(await command(socket, { type: 'pairing-approve', ...approval })).toMatchObject({
		ok: false,
		error: 'not-found'
	});
	expect(await answer(await exchange(request))).toEqual(failed);
});

test('of several exchanges at once only one receives a credential', async () => {
	const pairing = await approved();
	const responses = await Promise.all(Array.from({ length: 6 }, () => exchange(pairing)));
	const statuses = responses.map((response) => response.status).sort();
	expect(statuses).toEqual([200, 400, 400, 400, 400, 400]);
});

test('an approval that expired cannot be exchanged', async () => {
	const before = await deviceCount();
	const pairing = await approved(900);
	await new Promise((resolve) => setTimeout(resolve, 1100));
	expect(await answer(await exchange(pairing))).toEqual(failed);
	expect(await deviceCount()).toBe(before);
});

test('pairing a device again replaces its credential and ends its socket', async () => {
	const first = await pairDevice(relay, host, socket);
	const open = await connectDevice(relay, host, first);
	const second = await pairDevice(relay, host, socket, first.deviceId);
	expect(second.deviceId).toBe(first.deviceId);
	expect(second.credential).not.toBe(first.credential);
	expect((await open.closed).code).toBe(4401);
	const url = connectUrl(relay, host.hostId);
	expect(await RelaySocket.refusal(url, deviceHeaders(first))).toMatchObject({
		status: 401,
		error: 'credential-invalid'
	});
	const again = await connectDevice(relay, host, second);
	const summary = await relay.manage('summary', ownerOf(host));
	const devices = ((await summary.json()) as { devices: { deviceId: string }[] }).devices;
	expect(devices.filter((device) => device.deviceId === first.deviceId)).toHaveLength(1);
	again.close();
});
