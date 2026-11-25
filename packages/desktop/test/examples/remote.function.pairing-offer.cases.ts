import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { pairingOffer } from '../../src/services/networking-security/remote-host-service/pairingOffer';
import { InvalidPairingOfferError } from '../../src/services/networking-security/remote-host-service/pairingOffer.types';
import type { PairingOffer } from '../../../remote/src/utils/networking-security/pairingOffer.types';

export const unitId = 'remote.function.pairing-offer';

export const relayOffer: PairingOffer = {
	origin: 'https://relay.example.com',
	hostId: '9c1f4e7a0b2d385f6e1a4c9b07d3e8f2a5b61c40',
	pairingId: '5e0b7d2a9c4f1e83b6d0a2f7c9e1b405',
	code: 'K7Q2M9TH',
	expiresAt: '2026-11-15T12:05:00.000Z'
};

export const localOffer: PairingOffer = {
	origin: 'http://127.0.0.1:8787',
	hostId: 'b3d7e1f0a92c4685d1e0f7a3c9b28e4d6f1a0c57',
	pairingId: 'a14c9e06f2d8b35e7c01f9a4d6b28e3f',
	code: '4WXHP6RD',
	expiresAt: '2026-11-15T12:04:30.000Z'
};

export const relayText =
	'harness-pair:v1;aud=harness-phone;env=production;exp=1794744300;host=9c1f4e7a0b2d385f6e1a4c9b07d3e8f2a5b61c40;pairing=5e0b7d2a9c4f1e83b6d0a2f7c9e1b405;code=K7Q2M9TH;origin=https://relay.example.com';

export const localText =
	'harness-pair:v1;aud=harness-phone;env=local;exp=1794744270;host=b3d7e1f0a92c4685d1e0f7a3c9b28e4d6f1a0c57;pairing=a14c9e06f2d8b35e7c01f9a4d6b28e3f;code=4WXHP6RD;origin=http://127.0.0.1:8787';

/** The error pairingOffer throws for an offer it cannot write, as plain values. */
function refusedOffer(offer: PairingOffer): { name: string; message: string } {
	let error: unknown;
	try {
		pairingOffer(offer);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(InvalidPairingOfferError);
	const actual = error as Error;
	expect(actual.message).toBe('Invalid pairing offer.');
	return { name: actual.name, message: actual.message };
}

test('Writes the QR text of a production and a local offer', () => {
	const writes: Array<[string, PairingOffer, string]> = [
		['writes the production relay offer', relayOffer, relayText],
		['writes the local loopback offer', localOffer, localText],
		[
			'rounds a half-second expiry down to the whole second',
			{ ...relayOffer, expiresAt: '2026-11-15T12:05:00.999Z' },
			relayText
		],
		[
			'uppercases a hyphenated code and drops the hyphen',
			{ ...relayOffer, code: 'k7q2-m9th' },
			relayText
		]
	];
	const cases = writes.map(([name, offer, text]) => {
		const output = pairingOffer(offer);
		expect(output).toBe(text);
		return { name, input: offer, output };
	});
	recordExampleCases(
		{
			unitId,
			symbol: 'pairingOffer',
			state: 'writes-the-qr-text-of-a-production-and-a-local-offer',
			evidence: 'examples-cases',
			file: 'writes-the-qr-text-of-a-production-and-a-local-offer.json'
		},
		cases
	);
});

test('Refuses an offer whose origin is not a permitted relay', () => {
	const longOrigin = `https://${'a'.repeat(63)}.`.repeat(4) + 'example.com';
	const refusals: Array<[string, string]> = [
		['refuses a plain http relay', 'http://relay.example.com'],
		['refuses localhost on the https scheme', 'https://localhost'],
		['refuses the default https port', 'https://relay.example.com:443'],
		['refuses the default http port', 'http://127.0.0.1:80'],
		['refuses a trailing slash', 'https://relay.example.com/'],
		['refuses an origin that makes the text longer than 320 characters', longOrigin]
	];
	const cases = refusals.map(([name, origin]) => {
		const offer = { ...relayOffer, origin };
		return { name, input: offer, error: refusedOffer(offer) };
	});
	recordExampleCases(
		{
			unitId,
			symbol: 'pairingOffer',
			state: 'refuses-an-offer-whose-origin-is-not-a-permitted-relay',
			evidence: 'examples-cases',
			file: 'refuses-an-offer-whose-origin-is-not-a-permitted-relay.json'
		},
		cases
	);
});
