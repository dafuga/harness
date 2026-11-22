import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { AuthFailure, authFail } from '../../src/utils/accounts-access/authFail';

function summarizeFailure(code: 'auth-disabled' | 'email-code-invalid' | 'not-found') {
	try {
		authFail(code);
	} catch (error) {
		if (error instanceof AuthFailure) {
			return { name: error.name, code: error.code, message: error.message, status: error.status };
		}
		throw error;
	}
}

test('Authentication failures map codes to statuses', () => {
	const disabled = new AuthFailure('auth-disabled');
	const emailCodeInvalid = summarizeFailure('email-code-invalid');
	const missing = summarizeFailure('not-found');
	expect({
		constructor: { name: disabled.name, code: disabled.code, message: disabled.message, status: disabled.status },
		emailCodeInvalid,
		missing
	}).toEqual({
		constructor: { name: 'AuthFailure', code: 'auth-disabled', message: 'Hub auth auth-disabled', status: 503 },
		emailCodeInvalid: { name: 'AuthFailure', code: 'email-code-invalid', message: 'Hub auth email-code-invalid', status: 400 },
		missing: { name: 'AuthFailure', code: 'not-found', message: 'Hub auth not-found', status: 404 }
	});
	recordExampleCases(
		{
			unitId: 'hub.function.auth-fail',
			symbol: 'authFail',
			state: 'authentication-failures-map-codes-to-statuses',
			evidence: 'examples-cases',
			file: 'authentication-failures-map-codes-to-statuses.json'
		},
		[
			{
				name: 'disabled authentication uses service unavailable status',
				input: { constructorCode: 'auth-disabled' },
				output: { name: disabled.name, code: disabled.code, message: disabled.message, status: disabled.status }
			},
			{ name: 'invalid email code uses bad request status', input: { authFailCode: 'email-code-invalid' }, output: emailCodeInvalid },
			{ name: 'missing resource uses not found status', input: { authFailCode: 'not-found' }, output: missing }
		]
	);
});
