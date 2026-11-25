import { expect, test } from 'vitest';
import { DevicePairingService } from '../../src/services/networking-security/device-pairing-service/DevicePairingService';
import { HostPairingService } from '../../src/services/host-pairing-service/HostPairingService';
import { toBase64Url } from '../../src/utils/remoteBytes';
import { randomId, remoteIdentity, remotePatterns } from '../../src/utils/remoteIdentity';
import { remoteKeys } from '../../src/utils/remoteKeys';
import { memoryRelay } from '../support/memoryRelay';

const grant = { projects: [{ id: 'local-' + 'a'.repeat(64), name: 'Harness' }], agents: true },
	approval = { hostName: 'Fixture Mac', generation: 1, grant };
async function setup() {
	const keys = await remoteKeys(),
		hostId = await remoteIdentity(keys.publicKey),
		hostKey = toBase64Url(keys.publicKey),
		host = new HostPairingService({ hostId, keys });
	const relay = memoryRelay({ hostId, hostKey, host }),
		device = new DevicePairingService({ fetch: relay.fetch }),
		pairingId = randomId(16);
	const input = {
		origin: 'https://relay.example',
		hostId,
		pairingId,
		code: '',
		deviceName: 'Fixture phone',
		platform: 'test' as const
	};
	/** The signed-in account submits the sealed request; the relay verified the session. */
	const ask = (over: Partial<typeof input> = {}, key = hostKey) =>
		device.requestAccount({ ...input, ...over }, key, (body) => relay.submit(pairingId, body));
	return { host, hostId, relay, device, pairingId, input, ask };
}

test('a signed-in phone is paired to the exact key the host approved', async () => {
	const f = await setup(),
		pending = await f.ask();
	expect(f.relay.received).toHaveLength(1);
	expect(f.relay.received[0]).toMatchObject({
		pairingId: f.pairingId,
		deviceId: pending.deviceId,
		deviceName: 'Fixture phone',
		platform: 'test'
	});
	expect(await f.device.poll(pending)).toBe('requested');
	const approved = await f.host.approve(f.pairingId, approval);
	f.relay.approve(f.pairingId, approved);
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
test('the device name never reaches the relay in clear', async () => {
	const f = await setup();
	let body = '';
	const keys = await remoteKeys();
	await f.device
		.requestAccount(
			{ ...f.input, hostId: await remoteIdentity(keys.publicKey) },
			toBase64Url(keys.publicKey),
			async (sent) => {
				body = JSON.stringify(sent);
			}
		)
		.catch(() => undefined);
	expect(body).not.toContain('Fixture phone');
	expect(body).not.toBe('');
});
test('a relay that serves another host key is detected before anything is sent', async () => {
	const f = await setup();
	await expect(f.ask({}, toBase64Url((await remoteKeys()).publicKey))).rejects.toThrow();
	expect(f.relay.received).toEqual([]);
});
test('an account request takes no code', async () => {
	const f = await setup();
	expect(() => f.ask({ code: 'WRNG-CDE2' })).toThrow('takes no code');
	expect(f.relay.received).toEqual([]);
});
test('an approval for another device, or a tampered one, is refused', async () => {
	const other = await setup(),
		pendingOther = await other.ask(),
		approvedOther = await other.host.approve(other.pairingId, approval);
	other.relay.approve(other.pairingId, { ...approvedOther, deviceId: 'c'.repeat(40) });
	await expect(other.device.exchange(pendingOther)).rejects.toThrow();
	const f = await setup(),
		pending = await f.ask(),
		approved = await f.host.approve(f.pairingId, approval),
		sealed = (approved.sealed[0] === 'A' ? 'B' : 'A') + approved.sealed.slice(1);
	f.relay.approve(f.pairingId, { deviceId: approved.deviceId, sealed });
	await expect(f.device.exchange(pending)).rejects.toThrow();
});
test('only an exact relay origin and well-formed identifiers are used', async () => {
	const f = await setup();
	const refused = [
		{ origin: 'http://relay.example' },
		{ origin: 'https://relay.example/path?token=x' },
		{ hostId: '../' + f.hostId },
		{ pairingId: 'nope' }
	];
	for (const over of refused) await expect(f.ask(over)).rejects.toThrow();
	expect(f.relay.received).toEqual([]);
});
