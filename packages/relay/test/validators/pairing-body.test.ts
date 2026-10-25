import { expect, test } from 'vitest';
import { randomCredential } from '../../../remote/src/index';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import type { ComponentManifest } from '../../../../src/core/development-tooling/unitTypes';
import unit from '../../../../specification/units/relay.validator.pairing-body.json' with { type: 'json' };
import { PairingBodyValidator } from '../../src/validators/PairingBodyValidator';
import { newRequest } from '../support/relayActors';

async function requestInitialized(): Promise<void> {
	const validator = new PairingBodyValidator();
	const { body } = await newRequest('e6'.repeat(16));
	expect(validator.request({ ...body })).toEqual(body);
	for (const sealed of ['A'.repeat(22), 'A'.repeat(8192)])
		expect(validator.request({ ...body, sealed })).toEqual({ ...body, sealed });
	const refused: unknown[] = [
		undefined,
		'pairing body',
		7,
		null,
		[],
		[body.ephemeralKey, body.sealed, body.challenge],
		{},
		{ ...body, ephemeralKey: undefined },
		{ ...body, ephemeralKey: null },
		{ ...body, ephemeralKey: 7 },
		{ ...body, ephemeralKey: '' },
		{ ...body, ephemeralKey: body.challenge },
		{ ...body, ephemeralKey: body.ephemeralKey.slice(1) },
		{ ...body, ephemeralKey: `${body.ephemeralKey}A` },
		{ ...body, sealed: undefined },
		{ ...body, sealed: null },
		{ ...body, sealed: 7 },
		{ ...body, sealed: '' },
		{ ...body, sealed: 'A'.repeat(21) },
		{ ...body, sealed: 'A'.repeat(8193) },
		{ ...body, sealed: 'not base64url!' },
		{ ...body, challenge: undefined },
		{ ...body, challenge: null },
		{ ...body, challenge: 7 },
		{ ...body, challenge: '' },
		{ ...body, challenge: body.challenge.slice(1) },
		{ ...body, challenge: `${body.challenge}=` },
		{ ephemeralKey: body.ephemeralKey, sealed: body.sealed, deviceId: body.challenge },
		{ ...body, deviceId: 'd4'.repeat(20) },
		{ ...body, state: 'approved' }
	];
	for (const value of refused)
		expect(validator.request(value), JSON.stringify(value)).toBeUndefined();
}

async function verifierInitialized(): Promise<void> {
	const validator = new PairingBodyValidator();
	const verifier = randomCredential();
	expect(validator.verifier({ verifier })).toBe(verifier);
	for (const accepted of ['-'.repeat(43), '_'.repeat(43)])
		expect(validator.verifier({ verifier: accepted })).toBe(accepted);
	const refused: unknown[] = [
		undefined,
		verifier,
		null,
		[],
		[verifier],
		{},
		{ verifier: undefined },
		{ verifier: null },
		{ verifier: '' },
		{ verifier: verifier.slice(1) },
		{ verifier: `${verifier}A` },
		{ verifier: `${verifier}=` },
		{ verifier: `${verifier.slice(0, 42)}+` },
		{ verifier: 7 },
		{ verifier: [verifier] },
		{ verifier, credential: verifier },
		{ credential: verifier }
	];
	for (const value of refused)
		expect(validator.verifier(value), JSON.stringify(value)).toBeUndefined();
}

new TestExpectationService().registerCases(
	test,
	unit as ComponentManifest,
	'packages/relay/test/validators/pairing-body.test.ts',
	{
		'request-initialized': requestInitialized,
		'verifier-initialized': verifierInitialized
	}
);
