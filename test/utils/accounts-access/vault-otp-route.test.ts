import { expect, test } from 'vitest';
import { vaultOtpLimits, vaultOtpRoute } from '../../../src/utils/accounts-access/vaultOtpRoute';

const at = 1_795_000_012_345;

test('computes TOTP on the phone for the current 30 s step only', () => {
	const plan = vaultOtpRoute(['totp'], { kind: 'totp', issuedAt: at });
	expect(plan).toEqual({ route: 'phone-totp', sealed: true, expiresAt: 1_795_000_020_000 });
});

test('collects SMS codes with autofill and email codes or links on the phone, sealed, within 300 s', () => {
	expect(vaultOtpRoute(['sms', 'email'], { kind: 'sms', issuedAt: at })).toEqual({
		route: 'phone-entry',
		source: 'sms',
		sealed: true,
		autofill: true,
		acceptsLink: false,
		attempts: vaultOtpLimits.attempts,
		expiresAt: at + vaultOtpLimits.entryMs
	});
	expect(vaultOtpRoute(['sms', 'email'], { kind: 'email', issuedAt: at })).toMatchObject({
		route: 'phone-entry',
		source: 'email',
		autofill: false,
		acceptsLink: true
	});
});

test('confirms push and passkeys on the trusted device without sealing anything', () => {
	expect(vaultOtpRoute(['push', 'passkey'], { kind: 'passkey', issuedAt: at })).toMatchObject({
		route: 'device-confirm',
		kind: 'passkey',
		sealed: false
	});
});

test('stops on a challenge channel the recipe does not declare', () => {
	expect(vaultOtpRoute(['totp'], { kind: 'sms', issuedAt: at })).toMatchObject({ route: 'stop' });
});
