import { expect, test } from 'vitest';
import { DevicePairingService } from '../../src/services/device-pairing-service/DevicePairingService';
import { HostPairingService } from '../../src/services/host-pairing-service/HostPairingService';
import { toBase64Url } from '../../src/utils/remoteBytes';
import { remoteIdentity, remotePatterns } from '../../src/utils/remoteIdentity';
import { remoteKeys } from '../../src/utils/remoteKeys';
import { memoryRelay } from '../support/memoryRelay';

const grant = { projects: [{ id: 'local-' + 'a'.repeat(64), name: 'Harness' }], agents: true },
	approval = { hostName: 'Fixture Mac', generation: 1, grant };
async function setup() {
	const keys = await remoteKeys(),
		hostId = await remoteIdentity(keys.publicKey),
		host = new HostPairingService({ hostId, keys });
	const relay = memoryRelay({ hostId, hostKey: toBase64Url(keys.publicKey), host }),
		device = new DevicePairingService({ fetch: relay.fetch }),
		offer = host.open();
	relay.open(offer);
	const input = {
		origin: 'https://relay.example',
		hostId,
		pairingId: offer.pairingId,
		code: offer.code,
		deviceName: 'Fixture phone',
		platform: 'test' as const
	};
	return { host, hostId, relay, device, offer, input };
}

test('a phone that knows the code is paired to the exact key the host approved', async () => {
	const f = await setup(),
		pending = await f.device.request(f.input);
	expect(f.relay.received).toHaveLength(1);
	expect(f.relay.received[0]).toMatchObject({
		pairingId: f.offer.pairingId,
		deviceId: pending.deviceId,
		deviceName: 'Fixture phone',
		platform: 'test'
	});
	expect(await f.device.poll(pending)).toBe('requested');
	const approved = await f.host.approve(f.offer.pairingId, approval);
	f.relay.approve(f.offer.pairingId, approved);
	expect(await f.device.poll(pending)).toBe('approved');
	const credentials = await f.device.exchange(pending);
	expect(credentials).toMatchObject({
		origin: 'https://relay.example',
		hostId: f.hostId,
		deviceId: approved.deviceId,
		hostName: 'Fixture Mac',
		generation: 1,
		grant
	});
	expect(credentials.credential).toMatch(remotePatterns.credential);
	expect(credentials.keys.publicKey).toBe(approved.deviceKey);
	await expect(f.device.exchange(pending)).rejects.toThrow();
});
test('neither the code nor the device name reaches the relay in clear', async () => {
	const f = await setup();
	await f.device.request(f.input);
	const seen = f.relay.calls.join('\n') + f.relay.bodies.join('\n');
	expect(seen).not.toContain(f.offer.code);
	expect(seen).not.toContain(f.offer.code.replace('-', ''));
	expect(seen).not.toContain('Fixture phone');
	expect(f.relay.bodies).toHaveLength(1);
});
test('a relay that serves another host key is detected before anything is sent', async () => {
	const f = await setup();
	f.relay.relay.hostKey = toBase64Url((await remoteKeys()).publicKey);
	await expect(f.device.request(f.input)).rejects.toThrow();
	expect(f.relay.calls.filter((call) => call.startsWith('POST'))).toEqual([]);
	expect(f.relay.received).toEqual([]);
});
test('a wrong code is refused by the host, not by the relay', async () => {
	const f = await setup(),
		pending = await f.device.request({ ...f.input, code: 'WRNG-CDE2' });
	expect(f.relay.received).toEqual([null]);
	expect(f.host.requests()).toEqual([]);
	await expect(f.device.exchange(pending)).rejects.toThrow();
});
test('an approval for another device, or a tampered one, is refused', async () => {
	const other = await setup(),
		pendingOther = await other.device.request(other.input),
		approvedOther = await other.host.approve(other.offer.pairingId, approval);
	other.relay.approve(other.offer.pairingId, { ...approvedOther, deviceId: 'c'.repeat(40) });
	await expect(other.device.exchange(pendingOther)).rejects.toThrow();
	const f = await setup(),
		pending = await f.device.request(f.input),
		approved = await f.host.approve(f.offer.pairingId, approval),
		sealed = (approved.sealed[0] === 'A' ? 'B' : 'A') + approved.sealed.slice(1);
	f.relay.approve(f.offer.pairingId, { deviceId: approved.deviceId, sealed });
	await expect(f.device.exchange(pending)).rejects.toThrow();
});
test('only an exact relay origin and well-formed identifiers are contacted', async () => {
	const f = await setup();
	const refused = [
		{ ...f.input, origin: 'http://relay.example' },
		{ ...f.input, origin: 'https://relay.example/path?token=x' },
		{ ...f.input, hostId: '../' + f.hostId },
		{ ...f.input, pairingId: 'nope' },
		{ ...f.input, deviceName: '' }
	];
	for (const input of refused) await expect(f.device.request(input)).rejects.toThrow();
	expect(f.relay.calls).toEqual([]);
});
