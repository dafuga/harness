import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { readPairingOffer } from '../../../remote/src/services/networking-security/device-pairing-service/pairingOffer';
import { offerEnvironment } from '../../../remote/src/utils/networking-security/pairingOffer';
import type {
	OfferReading,
	PairingOffer
} from '../../../remote/src/utils/networking-security/pairingOffer.types';
import {
	unitId,
	relayText,
	relayOffer,
	localText,
	localOffer
} from './remote.function.pairing-offer.cases';

const now = 1794744000000;
const bothEnvironments: OfferReading = { now, environments: ['production', 'local'] };
const relayOnly: OfferReading = { now, environments: ['production'] };

/** Reads a scanned text and checks that it is refused for the given reason. */
function refusedRead(name: string, text: string, reading: OfferReading, refused: string) {
	const output = readPairingOffer(text, reading);
	expect(output).toEqual({ refused });
	return { name, input: { text, reading }, output };
}

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
