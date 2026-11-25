import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { loopbackArgument, localOrigin, redacted } from '../../scripts/ios-acceptance-guards';

test('allows only loopback http origins with a port', () => {
	const accepted = localOrigin('http://127.0.0.1:8787');
	const rejected = [
		'http://localhost:8787',
		'https://127.0.0.1:8787',
		'http://127.0.0.1:8787/'
	].map(localOrigin);
	expect(accepted).toBe(true);
	expect(rejected).toEqual([false, false, false]);
	expect(loopbackArgument).toBe('-HarnessRemoteLoopback');
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-guards',
			symbol: 'localOrigin',
			state: 'allows-only-loopback-http-origins-with-a-port',
			evidence: 'examples-cases',
			file: 'allows-only-loopback-http-origins-with-a-port.json'
		},
		[
			{ name: 'loopback relay origin', input: 'http://127.0.0.1:8787', output: accepted },
			{ name: 'localhost alias is refused', input: 'http://localhost:8787', output: rejected[0] },
			{ name: 'secure scheme is refused', input: 'https://127.0.0.1:8787', output: rejected[1] },
			{ name: 'trailing path is refused', input: 'http://127.0.0.1:8787/', output: rejected[2] }
		]
	);
});

test('redacts pairing codes in written and compact forms', () => {
	const text = 'Pairing code K7Q2-9WXM accepted; typed K7Q29WXM instead';
	const result = redacted(text, ['K7Q2-9WXM']);
	expect(result).toBe('Pairing code [hidden] accepted; typed [hidden] instead');
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-guards',
			symbol: 'redacted',
			state: 'redacts-pairing-codes-in-written-and-compact-forms',
			evidence: 'examples-cases',
			file: 'redacts-pairing-codes-in-written-and-compact-forms.json'
		},
		[
			{
				name: 'hide the pairing code with and without separators',
				input: { text, secrets: ['K7Q2-9WXM'] },
				output: result
			}
		]
	);
});
