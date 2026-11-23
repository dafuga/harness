import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { Actor } from 'collaboration';
import type { GithubOwnerOptions } from '../../src/lib/verification-evidence/server/auth/GithubOwnerService.types';
import { GithubOwnerService } from '../../src/lib/verification-evidence/server/auth/GithubOwnerService';
import { AuthFailure } from '../../src/utils/accounts-access/authFail';
import {
	EMAIL_CODE_LENGTH,
	NATIVE_AUDIENCE,
	NATIVE_ACTION
} from '../../src/models/accounts-access/HubAuthValues';

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

test('Throws AuthFailure when repository id is invalid', async () => {
	const service = new GithubOwnerService({} as GithubOwnerOptions);
	const actor = {} as Actor;

	await expect(service.authorizeRepository(actor, 0)).rejects.toBeInstanceOf(AuthFailure);
	await expect(service.authorizeRepository(actor, 0)).rejects.toMatchObject({
		name: 'AuthFailure',
		code: 'repository-denied',
		status: 403,
		message: 'Hub auth repository-denied'
	});
	recordExampleCases(
		{
			unitId: 'hub.model.hub-auth-types',
			symbol: 'HubAuth.authorizeRepository',
			state: 'throws-authfailure-when-repository-id-is-invalid',
			evidence: 'examples-cases',
			file: 'throws-authfailure-when-repository-id-is-invalid.json'
		},
		[
			{
				name: 'reject a non-positive repository id',
				input: { repositoryId: 0 },
				error: {
					name: 'AuthFailure',
					code: 'repository-denied',
					status: 403,
					message: 'Hub auth repository-denied'
				}
			}
		]
	);
});
