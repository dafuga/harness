import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	loopbackArgument,
	localOrigin,
	redacted,
	scanMarker,
	scanArgument,
	expiredOffer,
	otherVersion
} from '../../scripts/ios-acceptance-guards';

test('allows only loopback http origins with a port', () => {
	const accepted = localOrigin('http://127.0.0.1:8787');
	const rejected = ['http://localhost:8787', 'https://127.0.0.1:8787', 'http://127.0.0.1:8787/'].map(localOrigin);
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

test('ages and versions synthetic pairing offers', () => {
	const scan = 'harness-pair:v1;exp=1794787200;';
	const aged = expiredOffer(scan, 1794700800000);
	const versioned = otherVersion(scan);
	expect(aged).toBe('harness-pair:v1;exp=1794700740;');
	expect(versioned).toBe('harness-pair:v2;exp=1794787200;');
	expect([loopbackArgument, scanMarker, scanArgument]).toEqual([
		'-HarnessRemoteLoopback', 'HarnessSyntheticScans', '-HarnessSyntheticScans'
	]);
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-guards',
			symbol: 'expiredOffer',
			state: 'ages-and-versions-synthetic-pairing-offers',
			evidence: 'examples-cases',
			file: 'ages-and-versions-synthetic-pairing-offers.json'
		},
		[
			{ name: 'age offer by sixty seconds', input: { scan, now: 1794700800000 }, output: aged },
			{ name: 'mark offer as unsupported version', input: scan, output: versioned },
			{ name: 'fixed acceptance launch arguments', input: null, output: [loopbackArgument, scanMarker, scanArgument] }
		]
	);
});
