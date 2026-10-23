import type { Fixture } from './remote-pairing-binding.test.types';
import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { DevicePairingService } from '../../remote/src/index';
import { RemoteHostService } from '../src/services/remote-host-service/RemoteHostService';
import { hostFixture } from './remote-host-fixture';

const settle = { timeout: 15000 };
/** A phone asked with the code; then another request took its place at the relay. */
async function replaced(f: Fixture) {
	await f.host.enable();
	await f.online();
	const offer = await f.host.devices.createPairing(),
		pairing = new DevicePairingService({ fetch: f.relay.fetch }),
		input = { ...offer, deviceName: 'Fixture phone', platform: 'test' as const };
	const asked = await pairing.request(input);
	await expect.poll(async () => (await f.host.status()).requests.length, settle).toBe(1);
	const intruder = await pairing.request({ ...input, code: 'WRNG-CDE2', deviceName: 'Intruder' });
	const scope = { projectIds: [f.project.id], agents: true },
		approval = { pairingId: offer.pairingId, deviceId: asked.deviceId, ...scope };
	return { pairing, asked, intruder, approval };
}

test('an approval the relay refuses, because the request was replaced, approves no device', async () => {
	const f = await hostFixture(),
		{ pairing, asked, intruder, approval } = await replaced(f);
	expect((await f.host.status()).requests).toMatchObject([{ deviceId: asked.deviceId }]);
	await expect(f.host.devices.approvePairing(approval)).rejects.toThrow();
	expect(await f.host.status()).toMatchObject({ devices: [], requests: [], pairing: null });
	await expect(pairing.exchange(intruder)).rejects.toThrow();
	await expect(pairing.exchange(asked)).rejects.toThrow();
	expect(f.relay.refused).toBe(0);
	await f.host.stop();
	const restarted = new RemoteHostService(f.options());
	await restarted.start();
	await f.online(restarted);
	expect((await restarted.status()).devices).toEqual([]);
	await restarted.stop();
}, 40000);

test('a refused re-approval leaves the earlier approval of that phone as it was', async () => {
	const f = await hostFixture();
	await f.host.enable();
	await f.online();
	const { credentials } = await f.pair({ projectIds: [f.project.id], agents: false }),
		[before] = (await f.host.status()).devices;
	const offer = await f.host.devices.createPairing(),
		pairing = new DevicePairingService({ fetch: f.relay.fetch }),
		input = { ...offer, deviceName: 'Fixture phone', platform: 'test' as const },
		{ importRemoteKeys } = await import('../../remote/src/index'),
		keys = await importRemoteKeys(credentials.keys);
	await pairing.request(input, keys);
	await expect.poll(async () => (await f.host.status()).requests.length, settle).toBe(1);
	await pairing.request({ ...input, code: 'WRNG-CDE2' });
	const scope = { projectIds: [f.project.id], agents: true },
		again = { pairingId: offer.pairingId, deviceId: credentials.deviceId, ...scope };
	await expect(f.host.devices.approvePairing(again)).rejects.toThrow();
	expect((await f.host.status()).devices).toEqual([before]);
	expect(before).toMatchObject({ deviceId: credentials.deviceId, agents: false });
	const phone = f.phone(credentials);
	expect((await phone.connection.connect()).grant).toMatchObject({ agents: false });
}, 40000);

test('the approval names the phone that was shown: another identity approves nothing', async () => {
	const f = await hostFixture();
	await f.host.enable();
	await f.online();
	const offer = await f.host.devices.createPairing(),
		pairing = new DevicePairingService({ fetch: f.relay.fetch }),
		shown = await pairing.request({ ...offer, deviceName: 'Fixture phone', platform: 'test' }),
		scope = { pairingId: offer.pairingId, projectIds: [f.project.id], agents: true };
	await expect.poll(async () => (await f.host.status()).requests.length, settle).toBe(1);
	for (const input of [scope, { ...scope, deviceId: 'f'.repeat(40) }, { ...scope, deviceId: '' }])
		await expect(f.host.devices.approvePairing(input)).rejects.toThrow();
	const waiting = await f.host.status();
	expect(waiting.devices).toEqual([]);
	expect(waiting.requests).toMatchObject([{ deviceId: shown.deviceId }]);
	const approved = await f.host.devices.approvePairing({ ...scope, deviceId: shown.deviceId });
	expect(approved.devices).toMatchObject([{ deviceId: shown.deviceId, agents: true }]);
	expect((await pairing.exchange(shown)).deviceId).toBe(shown.deviceId);
}, 40000);
