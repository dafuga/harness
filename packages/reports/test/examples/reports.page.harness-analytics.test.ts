import { test } from 'vitest';
import { load } from '../../src/routes/harness/analytics/+page.server';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** The evidence of one state: its cases, under the unit and the load operation they show. */
const where = (state: string) => ({
	unitId: 'reports.page.harness-analytics',
	symbol: 'load',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** Calls load and returns what it threw, as plain JSON, or undefined when it returned. */
function callLoad(): { returned: unknown; thrown: unknown } {
	try {
		return { returned: load(), thrown: undefined };
	} catch (error) {
		return { returned: undefined, thrown: JSON.parse(JSON.stringify(error)) };
	}
}

test('load throws a 308 redirect to /harness', () => {
	const { returned, thrown } = callLoad();
	recordExampleCases(where('load-throws-a-308-redirect-to-harness'), [
		{
			name: 'a visitor opens the former console analytics address /harness/analytics',
			input: { route: '/harness/analytics' },
			...(thrown === undefined ? { output: returned } : { error: thrown })
		}
	]);
	expect(returned).toBeUndefined();
	expect(thrown).toEqual({ status: 308, location: '/harness' });
});
