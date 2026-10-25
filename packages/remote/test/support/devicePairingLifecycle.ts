import { expect } from 'vitest';
import { remotePatterns } from '../../src/utils/remoteIdentity';
import { setup, pendingAt, approve, type State } from './devicePairingFixture';

export async function pollState(state: State | 'initialized') {
	const f = await setup();
	if (state === 'initialized') return rejectedPairing(f.device.poll(undefined as never), TypeError);
	const pending = await pendingAt(f, state);
	if (state === 'exchanged') return rejectedPairing(f.device.poll(pending));
	const observed = await f.device.poll(pending);
	expect(observed).toBe(state);
	return { state: observed };
}

export async function exchangeRejected(state: State) {
	const f = await setup(),
		pending = await pendingAt(f, state);
	return rejectedPairing(f.device.exchange(pending));
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
	return {
		origin: credentials.origin,
		hostName: credentials.hostName,
		generation: credentials.generation,
		grant: credentials.grant,
		credentialValid: remotePatterns.credential.test(credentials.credential)
	};
}

/** Display an actual rejected operation's error name after its original rejection assertion. */
export async function rejectedPairing(attempt: Promise<unknown>, constructor = Error) {
	await expect(attempt).rejects.toThrow(constructor);
	try {
		await attempt;
	} catch (error) {
		expect(error).toBeInstanceOf(Error);
		return { error: (error as Error).name };
	}
}
