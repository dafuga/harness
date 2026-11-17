import { render } from 'svelte/server';
import { test } from 'vitest';
import DetailsPage from '../../src/routes/harness/branch/[branch]/[...at]/models/[entity]/details/+page.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real +page.svelte of the Model details route. It declares no props and reads no route
 * parameters, so it is rendered with no props, the way the router renders it with no data.
 */
const where = (state: string) => ({
	unitId: 'reports.page.harness-branch-branch-at-models-entity-details',
	symbol: '+page',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/**
 * The page's screen reads the request's page state (its URL) from SvelteKit's request context, so the
 * render gets that context from a made-up URL of the route it serves.
 */
const url = new URL('http://localhost/harness/branch/main/2f2066f79f/models/orders/details');
const context = new Map([['__request__', { page: { url, params: {}, data: {} } }]]);

test('Renders the Model details page markup', () => {
	const rendered = render(DetailsPage, { props: {}, context });
	const body = rendered.body.replace(/<!--.*?-->/gs, '');
	const head = rendered.head;
	recordExampleCases(where('renders-the-model-details-page-markup'), [
		{
			name: 'the page is rendered with no props at a Model details URL',
			input: { props: {}, url: url.href },
			output: {
				title: head.match(/<title>(.*?)<\/title>/s)?.[1] ?? null,
				bodyLength: body.length,
				bodyStart: body.slice(0, 200)
			}
		}
	]);
	expect(head).toContain('<title>Model details · Harness</title>');
	expect(body.length).toBeGreaterThan(0);
});
