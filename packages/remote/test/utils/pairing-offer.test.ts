import type { OfferVectors } from './pairing-offer.test.types';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { offerRules } from '../../src/utils/pairingOffer';
import { pairingOffer } from '../../../desktop/src/services/remote-host-service/pairingOffer';
import { readPairingOffer } from '../../src/services/device-pairing-service/pairingOffer';
import type { OfferEnvironment, PairingOffer } from '../../src/utils/pairingOffer';
const file = new URL('../support/offer-vectors.json', import.meta.url);
const vectors = JSON.parse(readFileSync(file, 'utf8')) as OfferVectors;

/**
 * The text of the QR code a computer shows. The vectors are shared with the Swift reader of the
 * phone app, which is held to the same answers by `bun run ios:check:vectors`.
 */
const { now, valid } = vectors;
const production: OfferEnvironment[] = ['production'];
const read = (text: string, environments = production) =>
	readPairingOffer(text, { now, environments });
const fields = ['harness-pair:v1', 'aud', 'env', 'exp', 'host', 'pairing', 'code', 'origin'];

test('an offer is written as one line that holds the offer and nothing else, and reads back', () => {
	const text = pairingOffer(valid.offer);
	expect(text).toBe(valid.text);
	expect(text.split(';').map((part) => part.split('=')[0])).toEqual(fields);
	expect(text.length).toBeLessThanOrEqual(offerRules.maxLength);
	expect(read(text)).toEqual({ offer: valid.offer });
	expect(pairingOffer({ ...valid.offer, code: 'KQ7M-2XWP' })).toBe(valid.text);
});

test('every shared vector reads as it says: only the exact text of an offer is one', () => {
	expect(vectors.cases.length).toBeGreaterThan(60);
	for (const item of vectors.cases) {
		const result = read(item.text, item.environments);
		const said = 'offer' in result ? 'ok' : result.refused;
		expect([item.name, said]).toEqual([item.name, item.result]);
	}
});

test('an offer that is read is the text that was scanned: written again it is the same', () => {
	const accepted = vectors.cases.filter((item) => item.result === 'ok');
	expect(accepted.length).toBeGreaterThan(5);
	for (const item of accepted) {
		const result = read(item.text, item.environments);
		expect('offer' in result && pairingOffer(result.offer)).toBe(item.text);
	}
});

test('an offer expires by the clock of the phone and cannot claim more than its short life', () => {
	const expires = Date.parse(valid.offer.expiresAt);
	const at = (time: number) =>
		readPairingOffer(valid.text, { now: time, environments: production });
	expect(at(expires - 1)).toEqual({ offer: valid.offer });
	expect(at(expires)).toEqual({ refused: 'expired' });
	expect(at(expires + 60_000)).toEqual({ refused: 'expired' });
	expect(at(expires - 360_000)).toEqual({ offer: valid.offer });
	expect(at(expires - 360_001)).toEqual({ refused: 'invalid' });
});

test('nothing but an offer can be written', () => {
	const refused = [
		{ origin: 'https://relay.example.invalid/' },
		{ origin: 'https://Relay.example.invalid' },
		{ origin: 'http://relay.example.invalid' },
		{ origin: 'https://192.168.1.4' },
		{ hostId: 'A'.repeat(40) },
		{ pairingId: 'b'.repeat(31) },
		{ code: 'KQ7M2XW0' },
		{ code: 'KQ7M' },
		{ expiresAt: 'soon' },
		{ origin: `https://${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.example` }
	];
	for (const change of refused)
		expect(() => pairingOffer({ ...valid.offer, ...change })).toThrow('Invalid pairing offer.');
});

test('what is not text is not an offer', () => {
	for (const value of [null, undefined, 7, {}, [valid.text]])
		expect(read(value as unknown as string)).toEqual({ refused: 'invalid' });
});
