import { test } from 'vitest';
import * as hubAuthStoreTypes from '../../src/models/accounts-access/HubAuthStore.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** The HubAuthStore model declares types only, so its source module has no runtime values. */
const ownedTypeNames = [
	'ChallengeRecord',
	'SessionKind',
	'SessionRecord',
	'GithubStateRecord',
	'GithubGrantRecord',
	'NativeExchangeStatus',
	'NativeExchangeRecord',
	'NativeApproval',
	'OneTimeStore',
	'SessionStore',
	'GrantState',
	'GrantLease',
	'GrantStore',
	'ExchangeStore',
	'AuthStore'
];

test('Importing the HubAuthStore model returns no runtime value', () => {
	const runtimeExports = Object.keys(hubAuthStoreTypes);
	const runtimeValues = ownedTypeNames.filter((name) => name in hubAuthStoreTypes);

	expect(runtimeExports).toEqual([]);
	expect(runtimeValues).toEqual([]);
	recordExampleCases(
		{
			unitId: 'hub.model.hub-auth-store-types',
			symbol: 'HubAuthStore.types',
			state: 'importing-the-hubauthstore-model-returns-no-runtime-value',
			evidence: 'examples-cases',
			file: 'importing-the-hubauthstore-model-returns-no-runtime-value.json'
		},
		[
			{
				name: 'import the model from its source file',
				input: {
					module: 'packages/hub/src/models/accounts-access/HubAuthStore.types.ts'
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
