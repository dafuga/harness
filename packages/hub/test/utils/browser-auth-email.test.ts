import { expect, test, vi } from 'vitest';
import { browserAuth } from '../../src/utils/browserAuth';
import { browserError } from '../../src/utils/browserError';
import type { BrowserApi } from '../../src/utils/browserApi';

test('a code is asked for without a body and verified with the typed code in the body', async () => {
	const pending = {
		actor: null,
		emailProof: { email: 'a@b.invalid', sent: true, expiresAt: null }
	};
	const send = vi.fn(async (..._request: unknown[]) => pending);
	const auth = browserAuth({ send } as unknown as BrowserApi);
	expect(await auth.emailStart()).toBe(pending);
	await auth.emailVerify('24681012');
	expect(send.mock.calls).toEqual([
		['POST', '/api/auth/email/start'],
		['POST', '/api/auth/email/verify', { code: '24681012' }]
	]);
	expect(send.mock.calls.flat().filter((part) => String(part).includes('?'))).toEqual([]);
});

test('each refusal of the email proof is explained, and none claims that mail went out', () => {
	expect(browserError('email-code-invalid', 400)).toMatch(/not right or has expired/);
	expect(browserError('email-rate-limited', 429)).toMatch(/Too many attempts/);
	expect(browserError('email-proof-required', 401)).toMatch(/Confirm your email address/);
	for (const code of ['email-delivery-disabled', 'email-delivery-failed'])
		expect(browserError(code, 503)).toMatch(/Nothing was (sent|delivered)/);
});
