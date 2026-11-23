import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hostedAddress } from '../../src/utils/networking-security/hostedAddress';

test('accepts secure approval URLs and normalizes their href', () => {
	const external = hostedAddress('https://devices.example.com/native/approval_7');
	const local = hostedAddress('http://localhost/native/device-42');
	const ipv4 = hostedAddress('http://127.0.0.1/native/device-42');
	const ipv6 = hostedAddress('http://[::1]/native/device-42');

	expect(external).toBe('https://devices.example.com/native/approval_7');
	expect(local).toBe('http://localhost/native/device-42');
	expect(ipv4).toBe('http://127.0.0.1/native/device-42');
	expect(ipv6).toBe('http://[::1]/native/device-42');

	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-address',
			symbol: 'hostedAddress',
			state: 'accepts-secure-approval-urls-and-normalizes-their-href',
			evidence: 'examples-cases',
			file: 'accepts-secure-approval-urls-and-normalizes-their-href.json'
		},
		[
			{
				name: 'secure external approval address',
				input: 'https://devices.example.com/native/approval_7',
				output: external
			},
			{
				name: 'localhost approval address',
				input: 'http://localhost/native/device-42',
				output: local
			},
			{
				name: 'IPv4 loopback approval address',
				input: 'http://127.0.0.1/native/device-42',
				output: ipv4
			},
			{
				name: 'IPv6 loopback approval address',
				input: 'http://[::1]/native/device-42',
				output: ipv6
			}
		]
	);
});

test('rejects addresses outside the plain approval URL rules', () => {
	const query = hostedAddress('https://devices.example.com/native/approval?source=app');
	const credentials = hostedAddress('https://user:pass@devices.example.com/native/approval');
	const remoteHttp = hostedAddress('http://devices.example.com/native/approval');
	const wrongPath = hostedAddress('https://devices.example.com/other/path');

	expect(query).toBeNull();
	expect(credentials).toBeNull();
	expect(remoteHttp).toBeNull();
	expect(wrongPath).toBeNull();

	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-address',
			symbol: 'hostedAddress',
			state: 'rejects-addresses-outside-the-plain-approval-url-rules',
			evidence: 'examples-cases',
			file: 'rejects-addresses-outside-the-plain-approval-url-rules.json'
		},
		[
			{
				name: 'query string is not allowed',
				input: 'https://devices.example.com/native/approval?source=app',
				output: query
			},
			{
				name: 'credentials are not allowed',
				input: 'https://user:pass@devices.example.com/native/approval',
				output: credentials
			},
			{
				name: 'remote HTTP is not secure',
				input: 'http://devices.example.com/native/approval',
				output: remoteHttp
			},
			{
				name: 'non-approval path',
				input: 'https://devices.example.com/other/path',
				output: wrongPath
			}
		]
	);
});
