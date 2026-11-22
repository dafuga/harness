import { render } from 'svelte/server';
import { test, vi } from 'vitest';
import Page from '../../src/routes/harness/branch/[branch]/[...at]/functions/[entity]/details/+page.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/harness/branch/example/functions/function-id/details') }
}));

test('Renders function details with the function details title', () => {
	const { body, head } = render(Page);
	const markup = `${head}${body}`;
	recordExampleCases(
		{
			unitId: 'reports.page.harness-branch-branch-at-functions-entity-details',
			symbol: '+page',
			state: 'renders-function-details-with-the-function-details-title',
			evidence: 'examples-cases',
			file: 'renders-function-details-with-the-function-details-title.json'
		},
		[
			{
				name: 'the route renders its function details page',
				input: {},
				output: { markup }
			}
		]
	);
	expect(markup).toContain('Function details');
});
