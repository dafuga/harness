import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import {
	signer,
	verifyRows,
	serviceFor,
	googleClaims,
	outcomesOf,
	recordCases,
	NOW_SECONDS,
	DANA,
	ISSUED_NONCE,
	CLIENT_ID
} from './hub.service.google-identity.cases';

const REJECTED = {
	name: 'AuthFailure',
	message: 'Hub auth credential-invalid',
	code: 'credential-invalid',
	status: 401
};

test('Rejects a credential with an untrusted signature', async () => {
	const { keys, sign } = await signer();
	const forger = await signer();
	const cases = await verifyRows(serviceFor(keys), sign, [
		['signed by a key outside the published set', googleClaims(), forger.sign],
		[
			'signed under a key id that Google does not publish',
			googleClaims(),
			(claims) => sign(claims, 'retired-key')
		]
	]);
	expect(outcomesOf(cases)).toEqual([REJECTED, REJECTED]);
	recordCases('rejects-a-credential-with-an-untrusted-signature', cases);
});

test('Applies a 10 second tolerance to credential expiry', async () => {
	const { keys, sign } = await signer();
	const cases = await verifyRows(serviceFor(keys), sign, [
		['expired 5 seconds ago, inside the tolerance', googleClaims({ exp: NOW_SECONDS - 5 })],
		['expired 30 seconds ago, outside the tolerance', googleClaims({ exp: NOW_SECONDS - 30 })]
	]);
	expect(outcomesOf(cases)).toEqual([DANA, REJECTED]);
	recordCases('applies-a-10-second-tolerance-to-credential-expiry', cases);
});

test('Rejects a credential whose nonce does not match', async () => {
	const { keys, sign } = await signer();
	const cases = await verifyRows(serviceFor(keys), sign, [
		[
			'nonce differing from the issued one in one character',
			googleClaims({ nonce: ISSUED_NONCE.replace('V', 'W') })
		],
		['nonce cut short', googleClaims({ nonce: ISSUED_NONCE.slice(0, 20) })]
	]);
	expect(outcomesOf(cases)).toEqual([REJECTED, REJECTED]);
	recordCases('rejects-a-credential-whose-nonce-does-not-match', cases);
});

test('Rejects a credential addressed to another client', async () => {
	const { keys, sign } = await signer();
	const other = 'other-client.apps.googleusercontent.com';
	const cases = await verifyRows(serviceFor(keys), sign, [
		['audience of another client', googleClaims({ aud: other })],
		['authorized party of another client', googleClaims({ azp: other })],
		['audience list that also names this client', googleClaims({ aud: [CLIENT_ID, other] })]
	]);
	expect(outcomesOf(cases)).toEqual([REJECTED, REJECTED, REJECTED]);
	recordCases('rejects-a-credential-addressed-to-another-client', cases);
});

test('Rejects a credential whose email is not verified', async () => {
	const { keys, sign } = await signer();
	const cases = await verifyRows(serviceFor(keys), sign, [
		['email_verified is false', googleClaims({ email_verified: false })],
		['email_verified sent as the string true', googleClaims({ email_verified: 'true' })],
		['no email claim', googleClaims({ email: undefined })]
	]);
	expect(outcomesOf(cases)).toEqual([REJECTED, REJECTED, REJECTED]);
	recordCases('rejects-a-credential-whose-email-is-not-verified', cases);
});
