import { render } from 'svelte/server';
import { test, vi } from 'vitest';
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/harness/branch/main/configs/sample/details') } }));
import Page from '../../src/routes/harness/branch/[branch]/[...at]/configs/[entity]/details/+page.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

test('Renders Config details with entity details content', () => {
	const result = render(Page);
	const output = {
		head: result.head,
		body: {
			containsTitle: result.body.includes('Config details'),
			containsInitialContent: result.body.includes('Loading history…'),
			containsMainRegion: result.body.includes('<main class="hx-main">')
		}
	};
	recordExampleCases(
		{
			unitId: 'reports.page.harness-branch-branch-at-configs-entity-details',
			symbol: '+page',
			state: 'renders-config-details-with-entity-details-content',
			evidence: 'examples-cases',
			file: 'renders-config-details-with-entity-details-content.json'
		},
		[
			{
				name: 'the config details route renders its fixed title and entity details screen',
				input: {},
				output
			}
		]
	);
	expect(result.head).toContain('<title>Config details · Harness</title>');
	expect(result.body).toContain('Loading history…');
	expect(result.body).toContain('<main class="hx-main">');
});
