import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { browserError } from '../../src/adapters/explorer-ui/browser-project-adapter/browserError';

test('explains known and unknown browser failures safely', () => {
	const known = browserError('session-required', 401);
	const unknownStatus = browserError('unknown-code', 503);
	const unknownOffline = browserError('unknown-code', 0);

	expect(known).toBe('Sign in to continue.');
	expect(unknownStatus).toBe('The request failed (503).');
	expect(unknownOffline).toBe('The server could not be reached.');

	recordExampleCases(
		{
			unitId: 'hub.function.browser-error',
			symbol: 'browserError',
			state: 'explains-known-and-unknown-browser-failures-safely',
			evidence: 'examples-cases',
			file: 'explains-known-and-unknown-browser-failures-safely.json'
		},
		[
			{
				name: 'known sign-in failure uses fixed wording',
				input: { code: 'session-required', status: 401 },
				output: known
			},
			{
				name: 'unknown failure includes only its status',
				input: { code: 'unknown-code', status: 503 },
				output: unknownStatus
			},
			{
				name: 'unknown failure without a status is unreachable',
				input: { code: 'unknown-code', status: 0 },
				output: unknownOffline
			}
		]
	);
});
