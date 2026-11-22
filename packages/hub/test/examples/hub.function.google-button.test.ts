import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { googleButton } from '../../src/components/accounts-access/login-panel/googleButton';
import { GoogleSignInLoadError } from '../../src/components/accounts-access/login-panel/googleButton.types';
import type { GoogleIdentity } from '../../src/components/accounts-access/login-panel/googleButton.types';
import { googleIdentityScript } from '../../src/utils/accounts-access/googleButton';

const unitId = 'hub.function.google-button';
const CLIENT_ID = 'fixture-client.example';
const NONCE = 'fixture-nonce-7f3a';
const SLOT = { id: 'fixture-button-slot' } as unknown as HTMLElement;

type InitConfig = Parameters<GoogleIdentity['initialize']>[0];
interface Seen {
	init?: InitConfig;
	rendered?: { element: HTMLElement; options: Record<string, string> };
}
interface FakeScript {
	src: string;
	async: boolean;
	onload: (() => void) | null;
	onerror: (() => void) | null;
}

// Stands in for the browser globals; the real code reads them only inside the load path.
const host = globalThis as unknown as { document?: unknown; google?: unknown };

function fakeIdentity(seen: Seen): GoogleIdentity {
	return {
		initialize: (config) => {
			seen.init = config;
		},
		renderButton: (element, options) => {
			seen.rendered = { element, options };
		}
	};
}

// The script's load or error event fires in a microtask, as it would in a browser.
function installBrowser(
	outcome: 'load' | 'error',
	identity: GoogleIdentity | undefined,
	scripts: string[]
): () => void {
	const previous = { document: host.document, google: host.google };
	host.google = identity ? { accounts: { id: identity } } : undefined;
	host.document = {
		createElement: (): FakeScript => ({ src: '', async: false, onload: null, onerror: null }),
		head: {
			appendChild: (script: FakeScript) => {
				scripts.push(script.src);
				queueMicrotask(() => (outcome === 'load' ? script.onload : script.onerror)?.());
			}
		}
	};
	return () => {
		host.document = previous.document;
		host.google = previous.google;
	};
}

async function withBrowser<T>(
	outcome: 'load' | 'error',
	identity: GoogleIdentity | undefined,
	scripts: string[],
	run: () => Promise<T>
): Promise<T> {
	const restore = installBrowser(outcome, identity, scripts);
	try {
		return await run();
	} finally {
		restore();
	}
}

test('Fixed Google Identity script address', () => {
	expect(googleIdentityScript).toBe('https://accounts.google.com/gsi/client');
	recordExampleCases(
		{
			unitId,
			symbol: 'googleIdentityScript',
			state: 'fixed-google-identity-script-address',
			evidence: 'examples-cases',
			file: 'fixed-google-identity-script-address.json'
		},
		[
			{
				name: 'identity script constant is Google Identity Services',
				input: {},
				output: googleIdentityScript
			}
		]
	);
});

test('Script load failure rejects with a load error', async () => {
	const scripts: string[] = [];
	const error = await withBrowser('error', undefined, scripts, () =>
		googleButton(SLOT, {
			clientId: CLIENT_ID,
			nonce: NONCE,
			credential: () => undefined
		}).catch((caught: unknown) => caught)
	);
	expect(scripts).toEqual([googleIdentityScript]);
	expect(error).toBeInstanceOf(GoogleSignInLoadError);
	expect(error).toMatchObject({
		name: 'GoogleSignInLoadError',
		message: 'Google sign-in could not be loaded.'
	});
	recordExampleCases(
		{
			unitId,
			symbol: 'googleButton',
			state: 'script-load-failure-rejects-with-a-load-error',
			evidence: 'examples-cases',
			file: 'script-load-failure-rejects-with-a-load-error.json'
		},
		[
			{
				name: 'Google identity script fails to load',
				input: { clientId: CLIENT_ID, nonce: NONCE },
				error: { name: 'GoogleSignInLoadError', message: 'Google sign-in could not be loaded.' }
			}
		]
	);
});

test('Popup button renders and forwards the credential', async () => {
	const scripts: string[] = [];
	const seen: Seen = {};
	const credentials: string[] = [];
	await withBrowser('load', fakeIdentity(seen), scripts, () =>
		googleButton(SLOT, {
			clientId: CLIENT_ID,
			nonce: NONCE,
			credential: (value) => {
				credentials.push(value);
			}
		})
	);
	seen.init?.callback({ credential: 'fixture-credential' });
	expect(scripts).toEqual([googleIdentityScript]);
	expect(seen.init).toMatchObject({ client_id: CLIENT_ID, nonce: NONCE, ux_mode: 'popup' });
	expect(seen.rendered?.element).toBe(SLOT);
	expect(seen.rendered?.options).toEqual({
		theme: 'filled_black',
		size: 'large',
		text: 'signin_with'
	});
	expect(credentials).toEqual(['fixture-credential']);
	recordExampleCases(
		{
			unitId,
			symbol: 'googleButton',
			state: 'popup-button-renders-and-forwards-the-credential',
			evidence: 'examples-cases',
			file: 'popup-button-renders-and-forwards-the-credential.json'
		},
		[
			{
				name: 'identity loads and the button renders with fixture client and nonce',
				input: { clientId: CLIENT_ID, nonce: NONCE },
				output: {
					script: scripts[0],
					initialize: { client_id: CLIENT_ID, nonce: NONCE, ux_mode: 'popup' },
					renderButton: seen.rendered?.options,
					credentials
				}
			}
		]
	);
});
