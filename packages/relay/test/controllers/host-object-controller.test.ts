import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomId } from '../../../remote/src/index';
import {
	connectHost,
	newHost,
	openPairing,
	ownerOf,
	pairingPath,
	registerHost,
	registration
} from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';

const missing = [404, { error: 'not-found' }];
let relay: RelayFixture;

beforeAll(async () => {
	relay = await startRelay();
}, 60_000);
afterAll(() => relay.stop());

async function answer(response: Response): Promise<[number, unknown]> {
	return [response.status, await response.json()];
}

test('a host object knows four management operations and only by POST', async () => {
	const host = await registerHost(relay);
	const body = ownerOf(host);
	for (const path of [
		'/manage/destroy',
		'/manage/',
		'/manage',
		'/manage/summary/',
		'/manage/register/x'
	]) {
		expect(await answer(await relay.manage('', body, { path })), path).toEqual(missing);
	}
	for (const method of ['GET', 'PUT', 'DELETE']) {
		const response = await relay.manage('summary', body, { method });
		expect(await answer(response), method).toEqual(missing);
	}
	expect((await relay.manage('summary', body)).status).toBe(200);
});

test('a host object serves nothing outside its routes', async () => {
	const host = await registerHost(relay);
	for (const path of [
		'/',
		'/v1/health',
		'/v1/hosts',
		`/v1/hosts/${host.hostId}`,
		'/internal/state'
	]) {
		const response = await relay.manage('', ownerOf(host), { path, method: 'GET' });
		expect(await answer(response), path).toEqual(missing);
	}
});

test('a host object refuses to register a host under another name', async () => {
	const host = await newHost();
	const elsewhere = await newHost();
	const response = await relay.manage('register', await registration(host), {
		object: elsewhere.hostId
	});
	expect(await answer(response)).toEqual([400, { error: 'invalid-input' }]);
	expect(await relay.rows(elsewhere.hostId)).toEqual([]);
	expect(await relay.rows(host.hostId)).toEqual([]);
});

test('a host object answers only for the host it is named after', async () => {
	const host = await registerHost(relay);
	const other = await registerHost(relay, host.ownerId);
	const socket = await connectHost(relay, host);
	const pairingId = await openPairing(socket);
	const path = pairingPath(host, pairingId);
	const direct = await relay.manage('', {}, { object: host.hostId, path, method: 'GET' });
	expect(direct.status).toBe(200);
	const crossed = await relay.manage('', {}, { object: other.hostId, path, method: 'GET' });
	expect(await answer(crossed)).toEqual(missing);
	const summary = await relay.manage('summary', ownerOf(host), { object: other.hostId });
	expect(await answer(summary)).toEqual(missing);
	const unregister = await relay.manage('unregister', ownerOf(host), { object: other.hostId });
	expect(await answer(unregister)).toEqual(missing);
	expect((await relay.manage('summary', ownerOf(other))).status).toBe(200);
	socket.close();
});

test('a host object without a host answers its public routes as not found', async () => {
	const host = await newHost();
	const path = pairingPath(host, randomId());
	const info = await relay.manage('', {}, { object: host.hostId, path, method: 'GET' });
	expect(await answer(info)).toEqual(missing);
	expect(await relay.rows(host.hostId)).toEqual([]);
});
