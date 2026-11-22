import { test } from 'vitest';
import { load } from '../../src/routes/+page.server';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** The evidence of one state: its cases, under the unit and the load function they show. */
const where = (state: string) => ({
	unitId: 'reports.page.root',
	symbol: 'load',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** Calls the real load and returns the redirect it throws, so the test can record and check it. */
function redirectOf(call: () => unknown): { status: number; location: string } {
	try {
		call();
	} catch (error) {
		const { status, location } = error as { status: number; location: string };
		return { status, location };
	}
	throw new Error('load() returned instead of redirecting');
}

test('load called for the root throws a 308 redirect to /harness', () => {
	const first = redirectOf(() => load());
	const second = redirectOf(() => load());
	recordExampleCases(where('load-called-for-the-root-throws-a-308-redirect-to-harness'), [
		{
			name: 'SvelteKit calls load() for a request to / with no arguments',
			input: [],
			error: first
		},
		{
			name: 'a second request to / gets the same redirect, since load has no branch that skips it',
			input: [],
			error: second
		}
	]);
	expect(first).toEqual({ status: 308, location: '/harness' });
	expect(second).toEqual(first);
});
