import { afterEach, expect, test, vi } from 'vitest';
import { googleButton } from '../../src/components/login-panel/googleButton';
import { googleIdentityScript } from '../../src/utils/googleButton';

afterEach(() => vi.unstubAllGlobals());

test('the official script is loaded once and the button carries the challenge nonce', async () => {
	const initialize = vi.fn();
	const renderButton = vi.fn();
	const scripts: { src: string; onload: () => void; onerror: () => void }[] = [];
	const document = {
		createElement: () => {
			const script = { src: '', async: false, onload: () => {}, onerror: () => {} };
			scripts.push(script);
			return script;
		},
		head: {
			appendChild: (script: { onload: () => void }) => {
				vi.stubGlobal('google', { accounts: { id: { initialize, renderButton } } });
				script.onload();
			}
		}
	};
	vi.stubGlobal('document', document);
	const element = {} as HTMLElement;
	const credential = vi.fn();
	await googleButton(element, { clientId: 'client-1', nonce: 'nonce-1', credential });
	await googleButton(element, { clientId: 'client-1', nonce: 'nonce-2', credential });
	expect(googleIdentityScript).toBe('https://accounts.google.com/gsi/client');
	expect(scripts.map((script) => script.src)).toEqual([googleIdentityScript]);
	expect(initialize.mock.calls[0][0]).toMatchObject({ client_id: 'client-1', nonce: 'nonce-1' });
	expect(initialize.mock.calls[1][0]).toMatchObject({ nonce: 'nonce-2' });
	expect(renderButton).toHaveBeenCalledWith(element, expect.any(Object));
	initialize.mock.calls[0][0].callback({ credential: 'google-credential' });
	expect(credential).toHaveBeenCalledWith('google-credential');
});
