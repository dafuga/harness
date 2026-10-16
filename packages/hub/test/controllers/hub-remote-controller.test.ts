import { expect, test } from 'vitest';
import { actor, outsider } from '../support/projectionFixture';
import {
	DEVICE_ID,
	RELAY_ORIGIN,
	hostIdentity,
	outcome,
	registration,
	remoteFixture
} from '../support/remoteFixture';
import { REGISTERED_AT } from '../support/remoteHostsFake';

const manage = (operation: string) => `https://relay.internal/manage/${operation}`;

test('an unauthenticated caller is refused before anything reaches the relay', async () => {
	const f = remoteFixture(),
		host = await hostIdentity(),
		path = `/hosts/${host.hostId}`;
	f.setActor(null);
	const requests: [string, string, unknown?][] = [
		['POST', '/hosts', registration(host)],
		['GET', path],
		['DELETE', `${path}/devices/${DEVICE_ID}`],
		['DELETE', path]
	];
	for (const [method, target, body] of requests)
		expect(await outcome(await f.send(method, target, body))).toBe('401 session-required');
	expect(f.relay.calls).toEqual([]);
	f.setActor(actor);
	expect(await outcome(await f.send('POST', '/hosts', registration(host)))).toBe('201 ok');
});

test('registration forwards the verified session actor and nothing the body claims', async () => {
	const f = remoteFixture(),
		host = await hostIdentity();
	const forged = {
		owner: { id: outsider.id },
		ownerId: outsider.id,
		actor: outsider,
		actorId: outsider.id,
		generation: 99,
		origin: 'https://evil.example',
		registeredAt: 'never'
	};
	const reply = await f.send('POST', '/hosts', { ...registration(host), ...forged });
	expect(reply.status).toBe(201);
	expect(reply.headers.get('Cache-Control')).toBe('no-store');
	expect(await reply.json()).toEqual({
		hostId: host.hostId,
		origin: RELAY_ORIGIN,
		generation: 1,
		registeredAt: REGISTERED_AT
	});
	expect(f.relay.calls).toEqual([
		{
			name: host.hostId,
			url: manage('register'),
			method: 'POST',
			contentType: 'application/json',
			body: { owner: { id: actor.id }, ...registration(host) }
		}
	]);
	expect(f.relay.hosts.get(host.hostId)?.ownerId).toBe(actor.id);
});

test('the owner reads the summary, revokes a device and unregisters the host', async () => {
	const f = remoteFixture(),
		host = await hostIdentity(),
		{ hostId } = host,
		path = `/hosts/${hostId}`,
		owner = { id: actor.id };
	await f.send('POST', '/hosts', registration(host));
	f.relay.addDevice(hostId, DEVICE_ID);
	const summary = await f.send('GET', path);
	expect(summary.status).toBe(200);
	expect(await summary.json()).toEqual({
		hostId,
		name: 'Studio Mac',
		online: false,
		generation: 1,
		registeredAt: REGISTERED_AT,
		devices: [{ deviceId: DEVICE_ID, online: true, createdAt: REGISTERED_AT, lastSeenAt: null }]
	});
	const revoked = await f.send('DELETE', `${path}/devices/${DEVICE_ID}`);
	expect([revoked.status, await revoked.json()]).toEqual([200, { ok: true }]);
	const again = await f.send('DELETE', `${path}/devices/${DEVICE_ID}`);
	expect(await outcome(again)).toBe('404 not-found');
	const removed = await f.send('DELETE', path);
	expect([removed.status, await removed.json()]).toEqual([200, { ok: true }]);
	expect(await outcome(await f.send('GET', path))).toBe('404 not-found');
	expect(
		f.relay.calls.slice(1).map((call) => [call.name, call.url, call.method, call.body])
	).toEqual([
		[hostId, manage('summary'), 'POST', { owner, hostId }],
		[hostId, manage('revoke-device'), 'POST', { owner, hostId, deviceId: DEVICE_ID }],
		[hostId, manage('revoke-device'), 'POST', { owner, hostId, deviceId: DEVICE_ID }],
		[hostId, manage('unregister'), 'POST', { owner, hostId }],
		[hostId, manage('summary'), 'POST', { owner, hostId }]
	]);
});

test('another signed-in person cannot read, revoke, unregister or take over the host', async () => {
	const f = remoteFixture(),
		host = await hostIdentity(),
		path = `/hosts/${host.hostId}`;
	await f.send('POST', '/hosts', registration(host));
	f.relay.addDevice(host.hostId, DEVICE_ID);
	f.setActor(outsider);
	const claimed = { owner: { id: actor.id }, ownerId: actor.id, actor, name: 'Taken' };
	const attempts: [string, string, unknown?][] = [
		['GET', path],
		['DELETE', `${path}/devices/${DEVICE_ID}`],
		['DELETE', path],
		['POST', '/hosts', registration(host, claimed)]
	];
	for (const [method, target, body] of attempts)
		expect(await outcome(await f.send(method, target, body))).toBe('403 forbidden');
	expect(f.relay.calls.slice(1).map((call) => call.body.owner)).toEqual(
		attempts.map(() => ({ id: outsider.id }))
	);
	f.setActor(actor);
	expect(await (await f.send('GET', path)).json()).toMatchObject({
		name: 'Studio Mac',
		generation: 1,
		devices: [{ deviceId: DEVICE_ID }]
	});
});

test('the same owner may register again and the relay counts the generation', async () => {
	const f = remoteFixture(),
		host = await hostIdentity();
	await f.send('POST', '/hosts', registration(host));
	const again = await f.send('POST', '/hosts', registration(host, { name: 'Renamed Mac' }));
	expect(again.status).toBe(201);
	expect(await again.json()).toMatchObject({ hostId: host.hostId, generation: 2 });
	expect(f.relay.hosts.get(host.hostId)?.name).toBe('Renamed Mac');
});
