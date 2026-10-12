import { expect, test, vi } from 'vitest';
import { browserAuth } from '../../src/utils/browserAuth';
import type { BrowserApi } from '../../src/utils/browserApi';

test('sign-in is a challenge, then the credential and its CSRF value in one body', async () => {
	const get = vi.fn(async () => ({ actor: null, configured: true, clientId: 'client-1' }));
	const send = vi.fn(async (_method: string, path: string) =>
		path.endsWith('challenge') ? { nonce: 'n1', csrf: 'c1' } : { ok: true }
	);
	const auth = browserAuth({ get, send } as unknown as BrowserApi);
	expect(await auth.status()).toEqual({ actor: null, configured: true, clientId: 'client-1' });
	expect(get).toHaveBeenCalledWith('/api/auth/status');
	expect(await auth.challenge()).toEqual({ nonce: 'n1', csrf: 'c1' });
	await auth.google('credential-1', 'c1');
	await auth.logout();
	expect(send.mock.calls).toEqual([
		['POST', '/api/auth/challenge'],
		['POST', '/api/auth/google', { credential: 'credential-1', csrf: 'c1' }],
		['POST', '/api/auth/logout']
	]);
});
