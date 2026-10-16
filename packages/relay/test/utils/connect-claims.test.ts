import { expect, test } from 'vitest';
import { connectClaims } from '../../src/utils/connectClaims';

const credential = 'Ab0_-'.repeat(8) + 'xyz';
const deviceId = 'c3'.repeat(20);
const bearer = `Bearer ${credential}`;

function claims(values: Record<string, string>) {
	return connectClaims(new Headers(values));
}

test('connectClaims reads a host', () => {
	expect(claims({ Authorization: bearer, 'X-Harness-Role': 'host' })).toEqual({
		role: 'host',
		credential,
		deviceId: ''
	});
});

test('connectClaims reads a device', () => {
	const headers = {
		Authorization: bearer,
		'X-Harness-Role': 'device',
		'X-Harness-Device': deviceId
	};
	expect(claims(headers)).toEqual({ role: 'device', credential, deviceId });
});

test('connectClaims does not take a device id from a host', () => {
	const headers = { Authorization: bearer, 'X-Harness-Role': 'host', 'X-Harness-Device': deviceId };
	expect(claims(headers)?.deviceId).toBe('');
});

test('connectClaims accepts the scheme in any case', () => {
	const headers = { Authorization: `bearer ${credential}`, 'X-Harness-Role': 'host' };
	expect(claims(headers)?.credential).toBe(credential);
});

test('connectClaims refuses anything but a bearer of 43 base64url characters', () => {
	const refused = [
		'',
		credential,
		`Basic ${credential}`,
		`Bearer ${credential.slice(1)}`,
		`Bearer ${credential}A`,
		`Bearer ${credential}=`,
		`Bearer ${credential.slice(0, 42)}+`,
		`Bearer ${credential} ${credential}`,
		`Bearer  ${credential}`
	];
	for (const authorization of refused) {
		expect(claims({ Authorization: authorization, 'X-Harness-Role': 'host' })).toBeUndefined();
	}
	expect(claims({ 'X-Harness-Role': 'host' })).toBeUndefined();
});

test('connectClaims refuses a missing or unknown role', () => {
	expect(claims({ Authorization: bearer })).toBeUndefined();
	expect(claims({ Authorization: bearer, 'X-Harness-Role': 'admin' })).toBeUndefined();
	expect(claims({ Authorization: bearer, 'X-Harness-Role': 'Host' })).toBeUndefined();
});

test('connectClaims requires a well-formed device id of a device', () => {
	const device = { Authorization: bearer, 'X-Harness-Role': 'device' };
	expect(claims(device)).toBeUndefined();
	expect(claims({ ...device, 'X-Harness-Device': deviceId.slice(2) })).toBeUndefined();
	expect(claims({ ...device, 'X-Harness-Device': deviceId.toUpperCase() })).toBeUndefined();
});
