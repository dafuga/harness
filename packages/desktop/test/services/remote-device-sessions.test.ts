import { expect, test } from 'vitest';
import { remoteIdentity, remoteKeys } from '../../../remote/src/index';
import { setup, writeToken } from './remote-device-sessions-fixture';

const pause = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test('an approved device completes the handshake and is served by its own session', async () => {
	const s = await setup(),
		phone = s.phone(),
		attachment = await phone.attach();
	expect(attachment).toMatchObject({
		role: 'device',
		device: { id: s.deviceId, name: 'Fixture phone' },
		host: { name: 'Fixture Mac' }
	});
	expect(await phone.client.request('listProjects')).toEqual([
		{ id: s.f.project.id, name: s.f.project.name, kind: 'local' }
	]);
	expect(s.sessions.connected(s.deviceId)).toBe(true);
	expect(JSON.stringify(s.sent)).not.toContain(s.f.project.name);
	expect(s.drops).toEqual([]);
}, 30000);
test('an unknown device is rejected before any key is derived', async () => {
	const s = await setup(),
		stranger = await remoteKeys(),
		phone = s.phone(stranger, await remoteIdentity(stranger.publicKey));
	expect(await phone.handshake()).toBeUndefined();
	expect(phone.received).toEqual([{ type: 'reject', reason: 'unknown-device' }]);
	expect(s.drops).toEqual([{ address: phone.address, code: 4401 }]);
}, 30000);
test('a device without the approved key is dropped at its first packet and gets no answer', async () => {
	const s = await setup(),
		phone = s.phone(await remoteKeys());
	await expect(phone.attach()).rejects.toMatchObject({ code: 'deadline' });
	expect(phone.received.map((packet) => packet.type)).toEqual(['accept']);
	expect(s.drops).toEqual([{ address: phone.address, code: 4400 }]);
	expect(s.sessions.connected(s.deviceId)).toBe(false);
}, 30000);
test('a newer connection of a device replaces the older one', async () => {
	const s = await setup(),
		first = s.phone(),
		second = s.phone();
	await first.attach();
	await second.attach();
	const before = first.received.length;
	expect(await second.client.request('listProjects')).toHaveLength(1);
	await first.client.request('listProjects').catch(() => undefined);
	expect(first.received).toHaveLength(before);
	expect(s.drops.at(-1)).toEqual({ address: first.address, code: 4400 });
}, 30000);
test('revocation ends the session: nothing more is answered and a new hello is rejected', async () => {
	const s = await setup(),
		phone = s.phone();
	await phone.attach();
	s.records.delete(s.deviceId);
	s.sessions.revoke(s.deviceId);
	const before = s.sent.length;
	await phone.client.request('listProjects').catch(() => undefined);
	await pause(20);
	expect(s.sent).toHaveLength(before);
	expect(s.sessions.connected(s.deviceId)).toBe(false);
	const again = s.phone();
	expect(await again.handshake()).toBeUndefined();
	expect(again.received).toEqual([{ type: 'reject', reason: 'unknown-device' }]);
}, 30000);

test('only the authorized paired phone can pull the local Tracker projection', async () => {
	const enabled = await setup(true);
	const allowed = enabled.phone();
	const attachment = await allowed.attach();
	expect(attachment.methods).toContain('trackerReplicaPull');
	const reply = await allowed.client.request('trackerReplicaPull', { version: 1 });
	expect(reply).toEqual({ kind: 'snapshot', rows: [], continuation: null, cursor: 'fixture' });
	expect(enabled.trackerRequests.map((url) => url.origin + url.pathname)).toEqual([
		'http://127.0.0.1:7701/phone-replica/v1'
	]);
	expect(enabled.trackerRequests[0].searchParams.get('scope')).toMatch(/^[a-f0-9]{64}$/);
	await expect(
		allowed.client.request('trackerReplicaPull', { version: 1, scope: 'caller' })
	).rejects.toMatchObject({ code: 'invalid-message' });
	expect(enabled.trackerRequests).toHaveLength(1);

	const disabled = await setup();
	const denied = disabled.phone();
	expect((await denied.attach()).methods).not.toContain('trackerReplicaPull');
	await expect(denied.client.request('trackerReplicaPull', { version: 1 })).rejects.toMatchObject({
		code: 'method-denied'
	});
	expect(disabled.trackerRequests).toEqual([]);
}, 30000);

test('keeps phone Tracker writes outside the paired read grant', async () => {
	const readOnly = await setup(true);
	const permitted = await setup(true, true);
	const denied = readOnly.phone(),
		writer = permitted.phone();
	expect((await denied.attach()).methods).not.toContain('trackerReplicaPush');
	expect((await writer.attach()).methods).toContain('trackerReplicaPush');
	const intentId = '00000000-0000-4000-8000-000000000011';
	const input = { version: 1, intentId, itemId: 'fixture001', action: 'note', text: 'Fixture' };
	await expect(denied.client.request('trackerReplicaPush', input)).rejects.toMatchObject({
		code: 'method-denied'
	});
	expect(readOnly.trackerRequests).toHaveLength(0);
	expect(await writer.client.request('trackerReplicaPush', input)).toEqual({
		intentId,
		status: 'accepted'
	});
	expect(JSON.stringify(permitted.sent)).not.toContain(writeToken);
}, 30000);

test('the encrypted device session advertises Vault only for the configured pairing', async () => {
	const paired = await setup(false, false, true);
	const phone = paired.phone();
	expect((await phone.attach()).methods).toContain('vaultInfo');
	expect(await phone.client.request('vaultInfo')).toEqual({
		deviceId: 'fixture-iphone',
		origin: 'https://vault.example.test'
	});
	expect(JSON.stringify(paired.sent)).not.toContain('fixture-iphone');
	const ordinary = (await setup()).phone();
	expect((await ordinary.attach()).methods).not.toContain('vaultInfo');
	await expect(ordinary.client.request('vaultInfo')).rejects.toMatchObject({
		code: 'method-denied'
	});
}, 30000);
