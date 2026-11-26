import { test, vi } from 'vitest';
import { createSessionStore } from '../../src/lib/stores/projects-sessions/session.svelte';
import type { BrowserAuth } from '../../src/utils/accounts-access/browserAuth.types';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

export function authOf(methods: Record<string, unknown>): BrowserAuth {
	return methods as unknown as BrowserAuth;
}

export function shown(session: ReturnType<typeof createSessionStore>) {
	return { status: session.status, error: session.error, busy: session.busy };
}

test('Starts with no status, an empty error and not busy', () => {
	const auth = authOf({ status: vi.fn() });
	const first = createSessionStore(auth);
	const second = createSessionStore(auth);
	const output = shown(first);
	expect(output).toEqual({ status: null, error: '', busy: false });
	expect(second).not.toBe(first);
	expect(shown(second)).toEqual(output);
	recordExampleCases(
		{
			unitId: 'hub.store.session',
			symbol: 'createSessionStore',
			state: 'starts-with-no-status-an-empty-error-and-not-busy',
			evidence: 'examples-cases',
			file: 'starts-with-no-status-an-empty-error-and-not-busy.json'
		},
		[
			{ name: 'new store from a browser auth client', input: { auth: 'status' }, output },
			{
				name: 'second store from the same client',
				input: { auth: 'status' },
				output: shown(second)
			}
		]
	);
});
