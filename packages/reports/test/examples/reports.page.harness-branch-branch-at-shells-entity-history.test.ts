import { render } from 'svelte/server';
import { test, vi } from 'vitest';
vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/harness/branch/main/shells/entity/history') }
}));
import Page from '../../src/routes/harness/branch/[branch]/[...at]/shells/[entity]/history/+page.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

test('Renders the Shell history document title', () => {
	const { head } = render(Page);
	const hasTitle = head.includes('<title>Shell history · Harness</title>');
	recordExampleCases(
		{
			unitId: 'reports.page.harness-branch-branch-at-shells-entity-history',
			symbol: '+page',
			state: 'renders-the-shell-history-document-title',
			evidence: 'examples-cases',
			file: 'renders-the-shell-history-document-title.json'
		},
		[
			{
				name: 'The history route renders its fixed document title',
				input: {},
				output: { title: 'Shell history', renderedTitle: hasTitle }
			}
		]
	);
	expect(hasTitle).toBe(true);
});
