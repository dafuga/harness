import { render } from 'svelte/server';
import { test, vi } from 'vitest';
import Page from '../../src/routes/harness/branch/[branch]/[...at]/types/[entity]/details/+page.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The screen reads the address of the page from $app/state, which only a running request provides.
 * A made-up address stands in for it, so the page renders as it would for one route.
 */
vi.mock('$app/state', () => ({
	page: {
		url: new URL(
			'http://localhost/harness/branch/feature%2Forders/commit/3f9c2a1/types/app.page.orders/details'
		)
	}
}));

/** The evidence of the one state: the page as it is rendered, under the unit it belongs to. */
const where = (state: string) => ({
	unitId: 'reports.page.harness-branch-branch-at-types-entity-details',
	symbol: '+page',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** The comments Svelte's server renderer writes around blocks, removed so the markup reads plainly. */
const plain = (markup: string) => markup.replace(/<!--\[-->|<!--\]-->|<!--\[-1-->|<!---->/g, '');

test('Renders Type details in the console while history loads', () => {
	const rendered = render(Page, { props: {} });
	const body = plain(rendered.body);
	const head = plain(rendered.head);
	const title = head.match(/<title>([^<]*)<\/title>/)?.[1] ?? null;
	const shell = body.includes('data-harness-component="harness-harness-console"');
	const loading = body.includes('Loading history…');
	recordExampleCases(where('renders-type-details-in-the-console-while-history-loads'), [
		{
			name: 'the page is rendered with no props at a route address of an entity type details',
			input: { props: {} },
			output: { title, shell, loading }
		}
	]);
	expect(title).toBe('Type details · Harness');
	expect(shell).toBe(true);
	// The content is mounted only once the history has loaded, so the server markup shows the wait.
	expect(loading).toBe(true);
});
