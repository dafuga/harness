import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { startRemoteFixture } from '../../scripts/remote-fixture-host';
import type { RemoteFixtureOptions } from '../../scripts/remote-fixture-host.types';

test('rejects a relay port outside the valid range', async () => {
	const options = {
		relayPort: -1,
		publicDirectory: '/tmp/remote-fixture-evidence',
		log: () => undefined
	} as RemoteFixtureOptions;
	let thrown: unknown;
	try {
		await startRemoteFixture(options);
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(Error);
	if (!(thrown instanceof Error)) throw new Error('Expected invalid relay port to reject.');
	const error = { name: thrown.name, message: thrown.message };
	recordExampleCases(
		{
			unitId: 'desktop.script.remote-fixture-host',
			symbol: 'startRemoteFixture',
			state: 'rejects-a-relay-port-outside-the-valid-range',
			evidence: 'examples-cases',
			file: 'rejects-a-relay-port-outside-the-valid-range.json'
		},
		[
			{
				name: 'invalid relay port is rejected during fixture startup',
				input: { relayPort: -1 },
				error
			}
		]
	);
});
