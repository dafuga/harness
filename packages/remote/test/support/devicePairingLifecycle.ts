import { expect } from 'vitest';
import { remotePatterns } from '../../src/utils/remoteIdentity';
import { setup, pendingAt, approve, type State } from './devicePairingFixture';

export async function pollState(state: State | 'initialized') {
	const f = await setup();
	if (state === 'initialized')
		return expect(f.device.poll(undefined as never)).rejects.toThrow(TypeError);
	const pending = await pendingAt(f, state);
	if (state === 'exchanged') return expect(f.device.poll(pending)).rejects.toThrow();
	expect(await f.device.poll(pending)).toBe(state);
}

export async function exchangeRejected(state: State) {
	const f = await setup(),
		pending = await pendingAt(f, state);
	await expect(f.device.exchange(pending)).rejects.toThrow();
}

export async function exchangeApproved() {
	const f = await setup(),
		pending = await pendingAt(f, 'approved');
	const credentials = await f.device.exchange(pending);
	expect(credentials.credential).toMatch(remotePatterns.credential);
	await expect(f.device.exchange(pending)).rejects.toThrow();
	const other = await setup(),
		otherPending = await other.device.request(other.input),
		otherResult = await approve(other);
	other.relay.approve(other.offer.pairingId, { ...otherResult, deviceId: 'c'.repeat(40) });
	await expect(other.device.exchange(otherPending)).rejects.toThrow();
	const tampered = await setup(),
		tamperedPending = await tampered.device.request(tampered.input),
		tamperedResult = await approve(tampered);
	const sealed = (tamperedResult.sealed[0] === 'A' ? 'B' : 'A') + tamperedResult.sealed.slice(1);
	tampered.relay.approve(tampered.offer.pairingId, { deviceId: tamperedResult.deviceId, sealed });
	await expect(tampered.device.exchange(tamperedPending)).rejects.toThrow();
}
