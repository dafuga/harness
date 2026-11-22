import { test } from 'vitest';
import * as hubEmailStoreTypes from '../../src/models/accounts-access/HubEmailStore.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** The HubEmailStore model declares types only, so its source module has no runtime values. */
const ownedTypeNames = [
	'EmailProofRecord',
	'EmailCodeIssue',
	'EmailCodeAttempt',
	'EmailProofStore',
	'EmailSendWindow',
	'VerifiedEmailRecord',
	'EmailLedgerStore'
];

test('Importing the HubEmailStore model returns no runtime value', () => {
	const runtimeExports = Object.keys(hubEmailStoreTypes);
	const runtimeValues = ownedTypeNames.filter((name) => name in hubEmailStoreTypes);

	expect(runtimeExports).toEqual([]);
	expect(runtimeValues).toEqual([]);
	recordExampleCases(
		{
			unitId: 'hub.model.accounts-access-hub-email-store-types',
			symbol: 'HubEmailStore.types',
			state: 'importing-the-hubemailstore-model-returns-no-runtime-value',
			evidence: 'examples-cases',
			file: 'importing-the-hubemailstore-model-returns-no-runtime-value.json'
		},
		[
			{
				name: 'import the model from its source file',
				input: {
					module: 'packages/hub/src/models/accounts-access/HubEmailStore.types.ts'
				},
				output: { runtimeExports }
			},
			{
				name: 'look up each type the model owns in the loaded module',
				input: { names: ownedTypeNames },
				output: { runtimeValues }
			}
		]
	);
});
