import { expect, test } from 'vitest';
import { browserError } from '../../src/utils/browserError';

test('known codes are explained and unknown ones reveal nothing of the server', () => {
	expect(browserError('session-required', 401)).toBe('Sign in to continue.');
	expect(browserError('invitation-expired', 400)).toMatch(/expired/);
	expect(browserError('hosted-execution-denied', 403)).toMatch(/runs no agent/);
	expect(browserError('auth-disabled', 503)).toMatch(/not configured/);
	expect(browserError('stack-trace-here', 500)).toBe('The request failed (500).');
	expect(browserError('', 0)).toBe('The server could not be reached.');
});
