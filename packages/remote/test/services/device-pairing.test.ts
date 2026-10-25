import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { PendingPairing } from '../../src/services/device-pairing-service/DevicePairingService';
import { DevicePairingService } from '../../src/services/device-pairing-service/DevicePairingService';
import { HostPairingService } from '../../src/services/host-pairing-service/HostPairingService';
import { pairingOffer } from '../../../desktop/src/services/remote-host-service/pairingOffer';
import type { OfferEnvironment } from '../../src/utils/pairingOffer';
import { toBase64Url } from '../../src/utils/remoteBytes';
import { remoteIdentity, remotePatterns } from '../../src/utils/remoteIdentity';
import { remoteKeys } from '../../src/utils/remoteKeys';
import { memoryRelay } from '../support/memoryRelay';

const origin = 'https://relay.example',
	phone = { deviceName: 'Fixture phone', platform: 'test' as const },
	production: OfferEnvironment[] = ['production'],
	grant = { projects: [{ id: 'local-' + 'a'.repeat(64), name: 'Harness' }], agents: true },
	approval = { hostName: 'Fixture Mac', generation: 1, grant };
const manifest = JSON.parse(
	readFileSync(new URL('../../../../test/fixtures/contract-migration/device-pairing-methods.json', import.meta.url), 'utf8')
) as { testing: { cases: { id: string; test: { title: string } }[] } };

type Fixture = Awaited<ReturnType<typeof setup>>;
type State = 'requested' | 'approved' | 'denied' | 'exchanged';
type Case = [id: string, title: string, run: () => Promise<void>];
const reading = (now = Date.now(), environments = production) => ({ now, environments });
const offerText = (f: Fixture, offer = f.offer) => pairingOffer({ origin, hostId: f.hostId, ...offer });
const scanText = (f: Fixture, text: string, now = Date.now(), environments = production) =>
	f.device.scanned(text, phone, reading(now, environments));
const scan = (f: Fixture, offer = f.offer, now = Date.now(), environments = production) =>
	scanText(f, offerText(f, offer), now, environments);

async function setup() {
	const keys = await remoteKeys(),
		hostId = await remoteIdentity(keys.publicKey),
		host = new HostPairingService({ hostId, keys }),
		relay = memoryRelay({ hostId, hostKey: toBase64Url(keys.publicKey), host }),
		device = new DevicePairingService({ fetch: relay.fetch }),
		offer = host.open();
	relay.open(offer);
	return {
		host,
		hostId,
		relay,
		device,
		offer,
		input: { origin, hostId, pairingId: offer.pairingId, code: offer.code, ...phone }
	};
}
async function approve(f: Fixture, pending: PendingPairing) {
	const result = await f.host.approve(f.offer.pairingId, approval);
	f.relay.approve(f.offer.pairingId, result);
	return result;
}
async function pendingAt(f: Fixture, state: State) {
	const pending = await f.device.request(f.input);
	if (state === 'requested') return pending;
	if (state === 'denied') {
		expect(f.host.deny(f.offer.pairingId)).toBe(true);
		f.relay.deny(f.offer.pairingId);
		return pending;
	}
	await approve(f, pending);
	if (state === 'exchanged') await f.device.exchange(pending);
	return pending;
}
async function nextOffer(f: Fixture) {
	const offer = f.host.open();
	f.relay.open(offer);
	return offer;
}
async function complete(f: Fixture, pending: PendingPairing) {
	const result = await approve(f, pending);
	expect(await f.device.poll(pending)).toBe('approved');
	const credentials = await f.device.exchange(pending);
	expect(credentials).toMatchObject({ origin, hostId: f.hostId, deviceId: result.deviceId, ...approval });
	expect(credentials.credential).toMatch(remotePatterns.credential);
	expect(credentials.keys.publicKey).toBe(result.deviceKey);
}

async function scanInitialized() {
	const f = await setup(),
		pending = await scan(f);
	expect(f.relay.received).toHaveLength(1);
	expect(f.relay.received[0]).toMatchObject({ pairingId: f.offer.pairingId, deviceId: pending.deviceId, ...phone });
	expect(await f.device.poll(pending)).toBe('requested');
	await complete(f, pending);
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
async function requestInitialized() {
	const f = await setup();
	const keys = await remoteKeys(), pending = await f.device.request(f.input, keys);
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
	const wrong = await setup(), wrongPending = await wrong.device.request({ ...wrong.input, code: 'WRNG-CDE2' });
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
}
async function requestedScan() {
	const f = await setup(), earlier = f.offer, earlierText = offerText(f, earlier), current = await nextOffer(f);
	await scan(f, earlier);
	expect(f.relay.received).toEqual([null]);
	expect(f.host.requests()).toEqual([]);
	f.relay.close(earlier.pairingId);
	await expect(scanText(f, earlierText)).rejects.toThrow('The pairing was refused or has expired.');
	const pending = await scan(f, current);
	expect(f.host.requests()).toMatchObject([{ deviceId: pending.deviceId }]);
}
async function requestedRequest() {
	const f = await setup();
	await f.device.request(f.input);
	const second = await f.device.request(f.input);
	expect(f.relay.received).toHaveLength(2);
	expect(f.relay.received[1]).toBeNull();
	expect(f.host.requests()).toHaveLength(1);
	expect(second.input.pairingId).toBe(f.offer.pairingId);
}
async function startAfter(state: Exclude<State, 'requested'>, useScan: boolean) {
	const f = await setup();
	await pendingAt(f, state);
	const offer = await nextOffer(f),
		pending = useScan ? await scan(f, offer) : await f.device.request({ ...f.input, ...offer });
	expect(f.host.requests()).toMatchObject([{ pairingId: offer.pairingId, deviceId: pending.deviceId }]);
}
async function pollState(state: State | 'initialized') {
	const f = await setup();
	if (state === 'initialized') return expect(f.device.poll(undefined as never)).rejects.toThrow(TypeError);
	const pending = await pendingAt(f, state);
	if (state === 'exchanged') return expect(f.device.poll(pending)).rejects.toThrow();
	expect(await f.device.poll(pending)).toBe(state);
}
async function exchangeRejected(state: State) {
	const f = await setup(), pending = await pendingAt(f, state);
	await expect(f.device.exchange(pending)).rejects.toThrow();
}
async function exchangeApproved() {
	const f = await setup(), pending = await pendingAt(f, 'approved');
	const credentials = await f.device.exchange(pending);
	expect(credentials.credential).toMatch(remotePatterns.credential);
	await expect(f.device.exchange(pending)).rejects.toThrow();
	const other = await setup(), otherPending = await other.device.request(other.input), otherResult = await approve(other, otherPending);
	other.relay.approve(other.offer.pairingId, { ...otherResult, deviceId: 'c'.repeat(40) });
	await expect(other.device.exchange(otherPending)).rejects.toThrow();
	const tampered = await setup(), tamperedPending = await tampered.device.request(tampered.input), tamperedResult = await approve(tampered, tamperedPending);
	const sealed = (tamperedResult.sealed[0] === 'A' ? 'B' : 'A') + tamperedResult.sealed.slice(1);
	tampered.relay.approve(tampered.offer.pairingId, { deviceId: tamperedResult.deviceId, sealed });
	await expect(tampered.device.exchange(tamperedPending)).rejects.toThrow();
}

const cases: Case[] = [
	['scanned-initialized', 'scanned initialized accepts a current offer and sends the exact request', scanInitialized],
	['scanned-initialized-errors', 'scanned initialized rejects unsupported, expired and malformed offers', scanErrors],
	['request-initialized', 'request initialized preserves encrypted wire and validation boundaries', requestInitialized],
	['poll-initialized', 'poll initialized rejects an absent pending pairing', async () => pollState('initialized')],
	['exchange-initialized', 'exchange initialized rejects an absent pending pairing', async () => {
		expect(new DevicePairingService()).toBeInstanceOf(DevicePairingService);
		await expect((await setup()).device.exchange(undefined as never)).rejects.toThrow(TypeError);
	}],
	['scanned-requested', 'scanned requested keeps an earlier code from replacing the current offer', requestedScan],
	['request-requested', 'request requested keeps the host refusal boundary', requestedRequest],
	['poll-requested', 'poll requested reports requested', async () => pollState('requested')],
	['exchange-requested', 'exchange requested refuses before approval', async () => exchangeRejected('requested')],
	['scanned-approved', 'scanned approved can start a separate current offer', async () => startAfter('approved', true)],
	['request-approved', 'request approved can start a separate current offer', async () => startAfter('approved', false)],
	['poll-approved', 'poll approved reports approved', async () => pollState('approved')],
	['exchange-approved', 'exchange approved returns credentials once', exchangeApproved],
	['scanned-denied', 'scanned denied can start a separate current offer', async () => startAfter('denied', true)],
	['request-denied', 'request denied can start a separate current offer', async () => startAfter('denied', false)],
	['poll-denied', 'poll denied reports denied', async () => pollState('denied')],
	['exchange-denied', 'exchange denied refuses credentials', async () => exchangeRejected('denied')],
	['scanned-exchanged', 'scanned exchanged can start a separate current offer', async () => startAfter('exchanged', true)],
	['request-exchanged', 'request exchanged can start a separate current offer', async () => startAfter('exchanged', false)],
	['poll-exchanged', 'poll exchanged refuses the consumed pairing', async () => pollState('exchanged')],
	['exchange-exchanged', 'exchange exchanged refuses a second credential', async () => exchangeRejected('exchanged')]
];
for (const [id, title, run] of cases)
	test(title, async () => {
		expect(manifest.testing.cases.find((item) => item.id === id)?.test.title).toBe(title);
		await run();
	});
