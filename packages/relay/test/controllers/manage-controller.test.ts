import { afterAll, beforeAll, expect, test } from 'vitest';
import { newHost, newIdentity, ownerOf, registerHost, registration } from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';

const deviceId = 'd4'.repeat(20);
let relay: RelayFixture;

beforeAll(async () => {
	relay = await startRelay();
}, 60_000);
afterAll(() => relay.stop());

async function answer(response: Response): Promise<[number, unknown]> {
	return [response.status, await response.json()];
}

test('a host is registered through the namespace binding', async () => {
	const host = await newHost();
	const before = Date.now();
	const response = await relay.manage('register', await registration(host));
	expect(response.status).toBe(200);
	expect(response.headers.get('Cache-Control')).toBe('no-store');
	const registered = (await response.json()) as { registeredAt: string };
	expect(registered).toEqual({
		hostId: host.hostId,
		generation: 1,
		registeredAt: registered.registeredAt
	});
	expect(Date.parse(registered.registeredAt)).toBeGreaterThanOrEqual(before - 1000);
	expect(new Date(registered.registeredAt).toISOString()).toBe(registered.registeredAt);
	const summary = await relay.manage('summary', ownerOf(host));
	expect(await answer(summary)).toEqual([
		200,
		{
			hostId: host.hostId,
			name: host.name,
			online: false,
			generation: 1,
			registeredAt: registered.registeredAt,
			devices: []
		}
	]);
});

test('a host id that is not the hash of the host key is refused', async () => {
	const host = await newHost();
	const other = await newIdentity();
	const body = await registration(host);
	const forged = await relay.manage('register', { ...body, hostKey: other.key });
	expect(await answer(forged)).toEqual([400, { error: 'invalid-input' }]);
	const borrowed = await relay.manage('register', { ...body, hostId: other.id });
	expect(await answer(borrowed)).toEqual([400, { error: 'invalid-input' }]);
	expect(await relay.rows(host.hostId)).toEqual([]);
	expect(await relay.rows(other.id)).toEqual([]);
});

test('a malformed registration is refused and stores nothing', async () => {
	const host = await newHost();
	const body = await registration(host);
	const changes: Record<string, unknown>[] = [
		{ owner: undefined },
		{ owner: { id: '' } },
		{ owner: 'owner' },
		{ credentialHash: host.credential },
		{ credentialHash: undefined },
		{ name: '' },
		{ name: 'n'.repeat(500) },
		{ hostKey: 'AAAA' }
	];
	for (const change of changes) {
		const response = await relay.manage('register', { ...body, ...change });
		expect(await answer(response), JSON.stringify(change)).toEqual([
			400,
			{ error: 'invalid-input' }
		]);
	}
	expect(await relay.rows(host.hostId)).toEqual([]);
});

test('another owner can neither take over nor read nor end a host', async () => {
	const host = await registerHost(relay, 'owner-a');
	const intruder = { ...host, ownerId: 'owner-b' };
	const forbidden = [403, { error: 'forbidden' }];
	expect(await answer(await relay.manage('register', await registration(intruder)))).toEqual(
		forbidden
	);
	expect(await answer(await relay.manage('summary', ownerOf(intruder)))).toEqual(forbidden);
	const revoke = await relay.manage('revoke-device', { ...ownerOf(intruder), deviceId });
	expect(await answer(revoke)).toEqual(forbidden);
	expect(await answer(await relay.manage('unregister', ownerOf(intruder)))).toEqual(forbidden);
	const summary = await relay.manage('summary', ownerOf(host));
	expect(await summary.json()).toMatchObject({ hostId: host.hostId, generation: 1 });
});

test('calls for a host that was never registered are not found', async () => {
	const host = await newHost();
	const missing = [404, { error: 'not-found' }];
	expect(await answer(await relay.manage('summary', ownerOf(host)))).toEqual(missing);
	const revoke = await relay.manage('revoke-device', { ...ownerOf(host), deviceId });
	expect(await answer(revoke)).toEqual(missing);
	expect(await answer(await relay.manage('unregister', ownerOf(host)))).toEqual(missing);
	expect(await relay.rows(host.hostId)).toEqual([]);
});

test('calls without a usable owner, host or device are invalid', async () => {
	const host = await registerHost(relay);
	const invalid = [400, { error: 'invalid-input' }];
	expect(await answer(await relay.manage('summary', { hostId: host.hostId }))).toEqual(invalid);
	const unowned = await relay.manage('unregister', { owner: { id: '' }, hostId: host.hostId });
	expect(await answer(unowned)).toEqual(invalid);
	const revoke = await relay.manage('revoke-device', { ...ownerOf(host), deviceId: 'abc' });
	expect(await answer(revoke)).toEqual(invalid);
	const summary = await relay.manage('summary', ownerOf(host));
	expect(summary.status).toBe(200);
});

test('revoking a device that does not exist is still acknowledged', async () => {
	const host = await registerHost(relay);
	const revoke = await relay.manage('revoke-device', { ...ownerOf(host), deviceId });
	expect(await answer(revoke)).toEqual([200, { ok: true }]);
});
