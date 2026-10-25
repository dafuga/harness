import { expect } from 'vitest';
import { toBase64Url } from '../../src/utils/remoteBytes';
import { remoteKeys } from '../../src/utils/remoteKeys';
import { setup, phone } from './devicePairingFixture';

export async function requestInitialized() {
	const f = await setup();
	const keys = await remoteKeys(),
		pending = await f.device.request(f.input, keys);
	expect(pending.keys).toBe(keys);
	expect(f.relay.received).toHaveLength(1);
	const seen = f.relay.calls.join('\n') + f.relay.bodies.join('\n');
	expect(seen).not.toContain(f.offer.code);
	expect(seen).not.toContain(f.offer.code.replace('-', ''));
	expect(seen).not.toContain(phone.deviceName);
	expect(f.relay.bodies).toHaveLength(1);
	const mismatch = await setup();
	mismatch.relay.relay.hostKey = toBase64Url((await remoteKeys()).publicKey);
	await expect(mismatch.device.request(mismatch.input)).rejects.toThrow();
	expect(mismatch.relay.calls.filter((call) => call.startsWith('POST'))).toEqual([]);
	expect(mismatch.relay.received).toEqual([]);
	const wrong = await setup(),
		wrongPending = await wrong.device.request({ ...wrong.input, code: 'WRNG-CDE2' });
	expect(wrong.relay.received).toEqual([null]);
	expect(wrong.host.requests()).toEqual([]);
	await expect(wrong.device.exchange(wrongPending)).rejects.toThrow();
	const invalid = await setup(),
		refused = [
			{ ...invalid.input, origin: 'http://relay.example' },
			{ ...invalid.input, origin: 'https://relay.example/path?token=x' },
			{ ...invalid.input, hostId: '../' + invalid.hostId },
			{ ...invalid.input, pairingId: 'nope' },
			{ ...invalid.input, deviceName: '' }
		];
	for (const input of refused) await expect(invalid.device.request(input)).rejects.toThrow();
	expect(invalid.relay.calls).toEqual([]);
	const ios = await setup();
	await ios.device.request({ ...ios.input, platform: undefined });
	expect(ios.relay.received[0]).toMatchObject({ platform: 'ios' });
	const wireRequests = f.relay.bodies.length;
	const state = await f.device.poll(pending);
	return {
		state,
		wireRequests,
		keysRetained: pending.keys === keys
	};
}

export async function requestedRequest() {
	const f = await setup();
	await f.device.request(f.input);
	const second = await f.device.request(f.input);
	expect(f.relay.received).toHaveLength(2);
	expect(f.relay.received[1]).toBeNull();
	expect(f.host.requests()).toHaveLength(1);
	expect(second.input.pairingId).toBe(f.offer.pairingId);
	return { requests: f.host.requests().length, secondRelayRequest: f.relay.received[1] };
}
