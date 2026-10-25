import { expect } from 'vitest';
import {
	setup,
	scan,
	scanText,
	offerText,
	complete,
	phone,
	pendingAt,
	nextOffer,
	origin,
	type State
} from './devicePairingFixture';

export async function scanInitialized() {
	const f = await setup(),
		pending = await scan(f);
	expect(f.relay.received).toHaveLength(1);
	expect(f.relay.received[0]).toMatchObject({
		pairingId: f.offer.pairingId,
		deviceId: pending.deviceId,
		...phone
	});
	expect(await f.device.poll(pending)).toBe('requested');
	await complete(f, pending);
	await scanErrors();
}

async function scanErrors() {
	const f = await setup(),
		text = offerText(f),
		refused: [string, Promise<unknown>][] = [
			['offer-expired', scan(f, f.offer, Date.now() + 301_000)],
			['offer-environment', scan(f, f.offer, Date.now(), ['local'])],
			['offer-unsupported', scanText(f, text.replace('harness-pair:v1;', 'harness-pair:v2;'))],
			['offer-invalid', scanText(f, text + ';credential=abc')],
			['offer-invalid', scanText(f, `harnessremote://pair?origin=${origin}&host=${f.hostId}`)],
			['offer-invalid', scanText(f, '')]
		];
	for (const [code, attempt] of refused) await expect(attempt).rejects.toThrow(code);
	expect(f.relay.calls).toEqual([]);
	expect(f.host.requests()).toEqual([]);
}

export async function requestedScan() {
	const f = await setup();
	await f.device.request(f.input);
	const earlier = f.offer,
		earlierText = offerText(f, earlier),
		current = await nextOffer(f);
	await scan(f, earlier);
	expect(f.relay.received.at(-1)).toBeNull();
	expect(f.host.requests()).toEqual([]);
	f.relay.close(earlier.pairingId);
	await expect(scanText(f, earlierText)).rejects.toThrow('The pairing was refused or has expired.');
	const pending = await scan(f, current);
	expect(f.host.requests()).toMatchObject([{ deviceId: pending.deviceId }]);
}

export async function startAfter(state: Exclude<State, 'requested'>, useScan: boolean) {
	const f = await setup();
	await pendingAt(f, state);
	const offer = await nextOffer(f),
		pending = useScan ? await scan(f, offer) : await f.device.request({ ...f.input, ...offer });
	expect(f.host.requests()).toMatchObject([
		{ pairingId: offer.pairingId, deviceId: pending.deviceId }
	]);
}
