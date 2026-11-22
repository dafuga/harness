import { render } from 'svelte/server';
import { test } from 'vitest';
import Page from '../../src/routes/harness/branch/[branch]/[...at]/pages/[entity]/details/+page.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

test('Renders the page details screen', () => {
	const result = render(Page, {
		context: new Map([
			[
				'__request__',
				{ page: { url: new URL('http://localhost/harness/branch/main/pages/example/details') } }
			]
		])
	});
	recordExampleCases(
		{
			unitId: 'reports.page.harness-branch-branch-at-pages-entity-details',
			symbol: '+page',
			state: 'renders-the-page-details-screen',
			evidence: 'examples-cases',
			file: 'renders-the-page-details-screen.json'
		},
		[
			{
				name: 'the details route renders its fixed page title',
				input: {},
				output: {
					head: result.head,
					showsHistoryLoadingState: result.body.includes('Loading history…')
				}
			}
		]
	);
	expect(result.head).toContain('<title>Page details · Harness</title>');
	expect(result.body).toContain('Loading history…');
});
