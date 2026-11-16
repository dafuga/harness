import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { EMAIL_CODE_LENGTH, NATIVE_AUDIENCE, NATIVE_ACTION } from '../../src/models/accounts-access/HubAuthValues';

test('Exports the HubAuth protocol constants', () => {
	const values = { EMAIL_CODE_LENGTH, NATIVE_AUDIENCE, NATIVE_ACTION };

	expect(values).toEqual({
		EMAIL_CODE_LENGTH: 8,
		NATIVE_AUDIENCE: 'harness-desktop',
		NATIVE_ACTION: 'native-session'
	});
	recordExampleCases(
		{
			unitId: 'hub.model.hub-auth-types',
			symbol: 'HubAuthValues',
			state: 'exports-the-hubauth-protocol-constants',
			evidence: 'examples-cases',
			file: 'exports-the-hubauth-protocol-constants.json'
		},
		[
			{
				name: 'load the model protocol constants',
				input: { module: 'HubAuthValues' },
				output: values
			}
		]
	);
});
