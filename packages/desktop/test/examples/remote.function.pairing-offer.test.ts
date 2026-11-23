import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { pairingOffer } from '../../src/services/networking-security/remote-host-service/pairingOffer';
import { InvalidPairingOfferError } from '../../src/services/networking-security/remote-host-service/pairingOffer.types';
import { readPairingOffer } from '../../../remote/src/services/networking-security/device-pairing-service/pairingOffer';
import { offerEnvironment } from '../../../remote/src/utils/networking-security/pairingOffer';
import type {
	OfferReading,
	PairingOffer
} from '../../../remote/src/utils/networking-security/pairingOffer.types';

const unitId = 'remote.function.pairing-offer';
const now = 1794744000000;
const bothEnvironments: OfferReading = { now, environments: ['production', 'local'] };
const relayOnly: OfferReading = { now, environments: ['production'] };

const relayOffer: PairingOffer = {
	origin: 'https://relay.example.com',
	hostId: '9c1f4e7a0b2d385f6e1a4c9b07d3e8f2a5b61c40',
	pairingId: '5e0b7d2a9c4f1e83b6d0a2f7c9e1b405',
	code: 'K7Q2M9TH',
	expiresAt: '2026-11-15T12:05:00.000Z'
};

const localOffer: PairingOffer = {
	origin: 'http://127.0.0.1:8787',
	hostId: 'b3d7e1f0a92c4685d1e0f7a3c9b28e4d6f1a0c57',
	pairingId: 'a14c9e06f2d8b35e7c01f9a4d6b28e3f',
	code: '4WXHP6RD',
	expiresAt: '2026-11-15T12:04:30.000Z'
};

const relayText =
	'harness-pair:v1;aud=harness-phone;env=production;exp=1794744300;host=9c1f4e7a0b2d385f6e1a4c9b07d3e8f2a5b61c40;pairing=5e0b7d2a9c4f1e83b6d0a2f7c9e1b405;code=K7Q2M9TH;origin=https://relay.example.com';

const localText =
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

/** Reads a scanned text and checks that it is refused for the given reason. */
function refusedRead(name: string, text: string, reading: OfferReading, refused: string) {
	const output = readPairingOffer(text, reading);
	expect(output).toEqual({ refused });
	return { name, input: { text, reading }, output };
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

test('Classifies relay origins as production, local or neither', () => {
	const origins: Array<[string, string | null]> = [
		['https://relay.example.com', 'production'],
		['https://relay.example.com:8443', 'production'],
		['http://localhost:3000', 'local'],
		['https://relay.example.com:443', null],
		['http://relay.example.com', null],
		['https://localhost', null],
		['http://127.0.0.1:80', null]
	];
	const cases = origins.map(([origin, expected]) => {
		const output = offerEnvironment(origin);
		expect(output).toBe(expected);
		return { name: `classifies ${origin}`, input: origin, output };
	});
	recordExampleCases(
		{
			unitId,
			symbol: 'offerEnvironment',
			state: 'classifies-relay-origins-as-production-local-or-neither',
			evidence: 'examples-cases',
			file: 'classifies-relay-origins-as-production-local-or-neither.json'
		},
		cases
	);
});

test('Reads a scanned production offer while it is fresh', () => {
	const reads: Array<[string, string, OfferReading, PairingOffer]> = [
		[
			'reads the production relay text for a build that accepts production',
			relayText,
			relayOnly,
			relayOffer
		],
		[
			'reads the local loopback text for a build that accepts local',
			localText,
			bothEnvironments,
			localOffer
		]
	];
	const cases = reads.map(([name, text, reading, offer]) => {
		const output = readPairingOffer(text, reading);
		expect(output).toEqual({ offer });
		return { name, input: { text, reading }, output };
	});
	recordExampleCases(
		{
			unitId,
			symbol: 'readPairingOffer',
			state: 'reads-a-scanned-production-offer-while-it-is-fresh',
			evidence: 'examples-cases',
			file: 'reads-a-scanned-production-offer-while-it-is-fresh.json'
		},
		cases
	);
});

test('Refuses expired offers and offers for a disabled environment', () => {
	const cases = [
		refusedRead(
			'refuses an offer read at the moment it expires',
			relayText,
			{ now: 1794744300000, environments: ['production', 'local'] },
			'expired'
		),
		refusedRead(
			'refuses a production relay for a build that accepts only local',
			relayText,
			{ now, environments: ['local'] },
			'environment'
		),
		refusedRead(
			'refuses a local fixture for a build that accepts only production',
			localText,
			relayOnly,
			'environment'
		),
		refusedRead(
			'refuses an env name this build does not know',
			relayText.replace('env=production', 'env=staging'),
			bothEnvironments,
			'environment'
		)
	];
	recordExampleCases(
		{
			unitId,
			symbol: 'readPairingOffer',
			state: 'refuses-expired-offers-and-offers-for-a-disabled-environment',
			evidence: 'examples-cases',
			file: 'refuses-expired-offers-and-offers-for-a-disabled-environment.json'
		},
		cases
	);
});

test('Refuses malformed, unsupported and far-future scanned texts', () => {
	const cases = [
		refusedRead(
			'refuses an env that does not match the origin',
			relayText.replace('env=production', 'env=local'),
			bothEnvironments,
			'invalid'
		),
		refusedRead(
			'refuses an expiry more than the allowed skew ahead',
			relayText.replace('exp=1794744300', 'exp=1794744400'),
			bothEnvironments,
			'invalid'
		),
		refusedRead('refuses a leading space', ` ${relayText}`, bothEnvironments, 'invalid'),
		refusedRead(
			'refuses a lower-case code',
			relayText.replace('code=K7Q2M9TH', 'code=k7q2m9th'),
			bothEnvironments,
			'invalid'
		),
		refusedRead(
			'refuses a text without the version prefix',
			relayText.replace('harness-pair:v1;', ''),
			bothEnvironments,
			'invalid'
		),
		refusedRead(
			'refuses fields written out of order',
			relayText.replace(/host=(\w+);pairing=(\w+)/, 'pairing=$2;host=$1'),
			bothEnvironments,
			'invalid'
		),
		refusedRead(
			'refuses a text longer than 320 characters',
			`${relayText};x=${'a'.repeat(300)}`,
			bothEnvironments,
			'invalid'
		),
		refusedRead(
			'refuses a version other than 1 as unsupported',
			relayText.replace('harness-pair:v1;', 'harness-pair:v2;'),
			bothEnvironments,
			'unsupported'
		),
		refusedRead(
			'refuses another audience as unsupported',
			relayText.replace('aud=harness-phone', 'aud=other-app'),
			bothEnvironments,
			'unsupported'
		)
	];
	recordExampleCases(
		{
			unitId,
			symbol: 'readPairingOffer',
			state: 'refuses-malformed-unsupported-and-far-future-scanned-texts',
			evidence: 'examples-cases',
			file: 'refuses-malformed-unsupported-and-far-future-scanned-texts.json'
		},
		cases
	);
});
