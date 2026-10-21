import { expect, test } from 'vitest';
import { observedTaskOperation } from '../../../../test/support/taskProfiles';
import { AuthFailure, authFail } from '../../src/utils/authFail';

test('authFail throws a coded failure with a stable status', async () => {
	expect(() => authFail('session-required')).toThrow(AuthFailure);
	const failure = await observedTaskOperation(
		'hub.function.auth-fail',
		'construct-authentication-rejection',
		() => new AuthFailure('repository-denied')
	);
	expect(failure.code).toBe('repository-denied');
	expect(failure.status).toBe(403);
	expect(new AuthFailure('auth-disabled').status).toBe(503);
	expect(failure.message).toBe('Hub auth repository-denied');
});
