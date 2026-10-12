import { beforeAll, expect, test } from 'vitest';
import { randomCredential } from '../../../remote/src/index';
import { PairingBodyValidator } from '../../src/validators/PairingBodyValidator';
import { newRequest } from '../support/relayActors';

const validator = new PairingBodyValidator();
let body: { ephemeralKey: string; sealed: string; challenge: string };

beforeAll(async () => {
	body = (await newRequest('e6'.repeat(16))).body;
});

test('PairingBodyValidator reads a pairing request', () => {
	expect(validator.request({ ...body })).toEqual(body);
});

test('PairingBodyValidator refuses a request with a missing, malformed or unknown field', () => {
	const refused: unknown[] = [
		null,
		[],
		{},
		{ ...body, ephemeralKey: undefined },
		{ ...body, ephemeralKey: body.challenge },
		{ ...body, ephemeralKey: `${body.ephemeralKey}A` },
		{ ...body, sealed: undefined },
		{ ...body, sealed: '' },
		{ ...body, sealed: 'not base64url!' },
		{ ...body, sealed: 7 },
		{ ...body, challenge: undefined },
		{ ...body, challenge: body.challenge.slice(1) },
		{ ...body, challenge: `${body.challenge}=` },
		{ ...body, deviceId: 'd4'.repeat(20) },
		{ ...body, state: 'approved' }
	];
	for (const value of refused)
		expect(validator.request(value), JSON.stringify(value)).toBeUndefined();
});

test('PairingBodyValidator reads the verifier of an exchange', () => {
	const verifier = randomCredential();
	expect(validator.verifier({ verifier })).toBe(verifier);
});

test('PairingBodyValidator refuses a verifier of another shape', () => {
	const verifier = randomCredential();
	const refused: unknown[] = [
		null,
		[],
		{},
		{ verifier: '' },
		{ verifier: verifier.slice(1) },
		{ verifier: `${verifier}A` },
		{ verifier: `${verifier.slice(0, 42)}+` },
		{ verifier: 7 },
		{ verifier: [verifier] },
		{ verifier, credential: verifier }
	];
	for (const value of refused)
		expect(validator.verifier(value), JSON.stringify(value)).toBeUndefined();
});
