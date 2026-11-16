import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { observeIosServices } from '../../scripts/ios-service-observers';
import { ServiceObservationError } from '../../scripts/ios-service-observers.types';

test('rejects a missing service baseline', async () => {
	let thrown: unknown;
	try {
		await observeIosServices(null, 1234);
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(ServiceObservationError);
	expect(thrown).toMatchObject({
		message: 'The services before the build could not be observed.'
	});
	if (!(thrown instanceof Error)) throw new Error('Expected a missing baseline error.');

	recordExampleCases(
		{
			unitId: 'desktop.script.ios-service-observers',
			symbol: 'observeIosServices',
			state: 'rejects-a-missing-service-baseline',
			evidence: 'examples-cases',
			file: 'rejects-a-missing-service-baseline.json'
		},
		[
			{
				name: 'reject a missing pre-build service snapshot',
				input: { rows: null, group: 1234 },
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});
