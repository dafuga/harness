import { afterAll, beforeAll, expect, test } from 'vitest';
import { credentialHash, randomCredential, randomId } from '../../../remote/src/index';
import {
	connectDevice,
	connectHost,
	connectUrl,
	deviceHeaders,
	hostHeaders,
	newHost,
	newRequest,
	ownerOf,
	pairDevice,
	pairingPath,
	registerHost,
	registration,
	requestPairing
} from '../support/relayActors';
import { startRelay, type RelayFixture, type StoredRow } from '../support/relayFixture';
import { RelaySocket } from '../support/relaySocket';

let relay: RelayFixture;

beforeAll(async () => {
	relay = await startRelay();
}, 60_000);
afterAll(() => relay.stop());

function record(rows: StoredRow[], key: string): Record<string, unknown> {
	const row = rows.find((item) => item.key === key);
	if (!row) throw new Error(`nothing is stored under ${key}`);
	return JSON.parse(row.value) as Record<string, unknown>;
}

test('an object of a host that was never registered stores nothing, whatever is asked', async () => {
	const unknown = await newHost();
	const pairingId = randomId();
	await relay.fetch(pairingPath(unknown, pairingId));
	await relay.post(pairingPath(unknown, pairingId, 'request'), (await newRequest(pairingId)).body);
	await relay.post(pairingPath(unknown, pairingId, 'exchange'), { verifier: randomCredential() });
	await RelaySocket.refusal(connectUrl(relay, unknown.hostId), hostHeaders(unknown));
	await relay.manage('summary', ownerOf(unknown));
	await relay.manage('unregister', ownerOf(unknown));
	expect(await relay.rows(unknown.hostId)).toEqual([]);
});

test('a registration is kept as one record that holds the hash it was given', async () => {
	const host = await newHost();
	const body = await registration(host);
	await relay.manage('register', body);
	const rows = await relay.rows(host.hostId);
	expect(rows.map((row) => row.key)).toEqual(['host']);
	const stored = record(rows, 'host');
	expect(stored).toEqual({
		hostId: host.hostId,
		ownerId: host.ownerId,
		hostKey: host.hostKey,
		credentialHash: body.credentialHash,
		name: host.name,
		generation: 1,
		registeredAt: stored.registeredAt
	});
});

test('credentials are kept as hashes only', async () => {
	const host = await registerHost(relay);
	const socket = await connectHost(relay, host);
	const device = await pairDevice(relay, host, socket);
	const pending = await requestPairing(relay, host, socket);
	const rows = await relay.rows(host.hostId);
	const everything = JSON.stringify(rows);
	expect(everything).not.toContain(host.credential);
	expect(everything).not.toContain(device.credential);
	expect(everything).not.toContain(pending.verifier);
	const stored = record(rows, `device:${device.deviceId}`);
	expect(stored.credentialHash).toBe(
		await credentialHash({ role: 'device', hostId: host.hostId, ...device })
	);
	expect(Object.keys(stored).sort()).toEqual([
		'createdAt',
		'credentialHash',
		'deviceId',
		'generation',
		'lastSeenAt'
	]);
	expect(record(rows, `pairing:${pending.pairingId}`)).toMatchObject({
		state: 'requested',
		challenge: pending.body.challenge,
		attempts: 1
	});
	socket.close();
});

test('a failed connect leaves a counter and nothing about the attempt', async () => {
	const host = await registerHost(relay);
	const guess = randomCredential();
	await RelaySocket.refusal(
		connectUrl(relay, host.hostId),
		hostHeaders({ ...host, credential: guess })
	);
	const rows = await relay.rows(host.hostId);
	expect(rows.map((row) => row.key)).toEqual(['host', 'rate:connect']);
	expect(record(rows, 'rate:connect')).toMatchObject({ count: 1 });
	expect(JSON.stringify(rows)).not.toContain(guess);
});

test('unregistering closes every socket and deletes everything', async () => {
	const host = await registerHost(relay);
	const socket = await connectHost(relay, host);
	const device = await pairDevice(relay, host, socket);
	const phone = await connectDevice(relay, host, device);
	await requestPairing(relay, host, socket);
	expect((await relay.rows(host.hostId)).length).toBeGreaterThan(2);
	const response = await relay.manage('unregister', ownerOf(host));
	expect([response.status, await response.json()]).toEqual([200, { ok: true }]);
	expect((await socket.closed).code).toBe(4401);
	expect((await phone.closed).code).toBe(4401);
	expect(await relay.rows(host.hostId)).toEqual([]);
	expect((await relay.manage('summary', ownerOf(host))).status).toBe(404);
	const url = connectUrl(relay, host.hostId);
	expect((await RelaySocket.refusal(url, hostHeaders(host))).status).toBe(401);
	expect((await RelaySocket.refusal(url, deviceHeaders(device))).status).toBe(401);
	expect(await relay.rows(host.hostId)).toEqual([]);
});

test('a host that was unregistered can be registered again, by anyone, from nothing', async () => {
	const host = await registerHost(relay, 'owner-a');
	await relay.manage('unregister', ownerOf(host));
	const next = { ...host, ownerId: 'owner-b', credential: randomCredential() };
	const response = await relay.manage('register', await registration(next));
	expect(await response.json()).toMatchObject({ hostId: host.hostId, generation: 1 });
	const socket = await connectHost(relay, next);
	socket.close();
});
