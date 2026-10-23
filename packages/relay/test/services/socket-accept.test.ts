import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomCredential } from '../../../remote/src/index';
import { relayConfig } from '../../src/configs/relayConfig';
import {
	connectHost,
	connectUrl,
	deviceHeaders,
	hostHeaders,
	newHost,
	newIdentity,
	pairDevice,
	registerHost,
	type TestDevice,
	type TestHost
} from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';
import { RelaySocket } from '../support/relaySocket';

const invalid = { status: 401, error: 'credential-invalid' };
let relay: RelayFixture;
let host: TestHost;
let device: TestDevice;
let other: TestDevice;
let url: string;

beforeAll(async () => {
	relay = await startRelay();
	host = await registerHost(relay);
	const socket = await connectHost(relay, host);
	device = await pairDevice(relay, host, socket);
	other = await pairDevice(relay, host, socket);
	socket.close();
	await socket.closed;
	url = connectUrl(relay, host.hostId);
}, 60_000);
afterAll(() => relay.stop());

test('a host that proves its credential is told its devices', async () => {
	const socket = await RelaySocket.open(url, hostHeaders(host));
	const ready = (await socket.next()) as { devices: { deviceId: string }[] };
	const devices = [...ready.devices].sort((left, right) =>
		left.deviceId.localeCompare(right.deviceId)
	);
	const expected = [device, other]
		.map((item) => ({ deviceId: item.deviceId, online: false }))
		.sort((left, right) => left.deviceId.localeCompare(right.deviceId));
	expect({ ...ready, devices }).toEqual({ type: 'ready', hostId: host.hostId, devices: expected });
	socket.close();
	await socket.closed;
});

test('a wrong, absent or malformed bearer is refused before the upgrade', async () => {
	const role = { 'X-Harness-Role': 'host' };
	const attempts: Record<string, string>[] = [
		{ ...role, Authorization: `Bearer ${randomCredential()}` },
		{ ...role },
		{ ...role, Authorization: `Basic ${host.credential}` },
		{ ...role, Authorization: host.credential },
		{ ...role, Authorization: `Bearer ${host.credential.slice(1)}` },
		{ ...role, Authorization: `Bearer ${host.credential}A` }
	];
	for (const headers of attempts) {
		expect(await RelaySocket.refusal(url, headers), JSON.stringify(headers)).toMatchObject(invalid);
	}
});

test('a role the relay does not know is refused', async () => {
	const authorization = { Authorization: `Bearer ${host.credential}` };
	expect(await RelaySocket.refusal(url, authorization)).toMatchObject(invalid);
	expect(
		await RelaySocket.refusal(url, { ...authorization, 'X-Harness-Role': 'admin' })
	).toMatchObject(invalid);
	const anonymous = { Authorization: `Bearer ${device.credential}`, 'X-Harness-Role': 'device' };
	expect(await RelaySocket.refusal(url, anonymous)).toMatchObject(invalid);
});

test('a credential opens only the socket it was issued for', async () => {
	const stranger = (await newIdentity()).id;
	const attempts: Record<string, string>[] = [
		deviceHeaders({ deviceId: device.deviceId, credential: host.credential }),
		deviceHeaders({ deviceId: stranger, credential: host.credential }),
		hostHeaders({ ...host, credential: device.credential }),
		deviceHeaders({ deviceId: other.deviceId, credential: device.credential }),
		deviceHeaders({ deviceId: stranger, credential: device.credential })
	];
	for (const headers of attempts) {
		expect(await RelaySocket.refusal(url, headers), JSON.stringify(headers)).toMatchObject(invalid);
	}
	const opened = await RelaySocket.open(url, deviceHeaders(device));
	opened.close();
	await opened.closed;
});

test('a credential of one host opens nothing on another', async () => {
	const elsewhere = await registerHost(relay);
	const unknown = await newHost();
	const borrowed = hostHeaders({ ...elsewhere, credential: host.credential });
	expect(await RelaySocket.refusal(connectUrl(relay, elsewhere.hostId), borrowed)).toMatchObject(
		invalid
	);
	const nowhere = connectUrl(relay, unknown.hostId);
	expect(await RelaySocket.refusal(nowhere, hostHeaders(unknown))).toMatchObject(invalid);
	expect(await RelaySocket.refusal(nowhere, deviceHeaders(device))).toMatchObject(invalid);
	expect(await relay.rows(unknown.hostId)).toEqual([]);
});

test('a bearer in the query string is ignored', async () => {
	const credential = encodeURIComponent(host.credential);
	const query = `?authorization=Bearer%20${credential}&access_token=${credential}&token=${credential}`;
	const refusal = await RelaySocket.refusal(`${url}${query}&role=host`, {
		'X-Harness-Role': 'host'
	});
	expect(refusal).toMatchObject(invalid);
	expect(await RelaySocket.refusal(`${url}${query}&X-Harness-Role=host`, {})).toMatchObject(
		invalid
	);
	const opened = await RelaySocket.open(`${url}?authorization=wrong`, hostHeaders(host));
	expect((await opened.next()).type).toBe('ready');
	opened.close();
	await opened.closed;
});

test('failed connects are limited per host, and a valid credential still connects', async () => {
	const busy = await registerHost(relay);
	const target = connectUrl(relay, busy.hostId);
	const wrong = hostHeaders({ ...busy, credential: randomCredential() });
	for (let attempt = 0; attempt < relayConfig.failedConnects; attempt += 1) {
		expect((await RelaySocket.refusal(target, wrong)).status).toBe(401);
	}
	expect(await RelaySocket.refusal(target, wrong)).toMatchObject({
		status: 429,
		error: 'rate-limited'
	});
	expect(await RelaySocket.refusal(target, wrong)).toMatchObject({
		status: 429,
		error: 'rate-limited'
	});
	const opened = await RelaySocket.open(target, hostHeaders(busy));
	expect((await opened.next()).type).toBe('ready');
	opened.close();
	const calm = await RelaySocket.refusal(
		url,
		hostHeaders({ ...host, credential: randomCredential() })
	);
	expect(calm.status).toBe(401);
});
