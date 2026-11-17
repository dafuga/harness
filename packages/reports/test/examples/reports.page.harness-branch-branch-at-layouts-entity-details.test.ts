import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from 'svelte/server';
import { test, vi } from 'vitest';
import Page from '../../src/routes/harness/branch/[branch]/[...at]/layouts/[entity]/details/+page.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The address the page is rendered at. SvelteKit reads `$app/state` from the request of a server
 * render, and a test has no request, so the store is stood in for here with the address of the
 * test. The page itself, and the Harness screen it mounts, are the real code.
 */
const address = vi.hoisted(() => ({ url: new URL('http://localhost/') }));

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return address.url;
		},
		params: {},
		route: { id: null },
		data: {},
		status: 200,
		error: null,
		form: null,
		state: {}
	}
}));

/** The evidence of one state: its cases, under the unit and the markup they show. */
const where = (state: string) => ({
	unitId: 'reports.page.harness-branch-branch-at-layouts-entity-details',
	symbol: '+page',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** The names of the components whose markup the page drew, in the order they first appear. */
function componentsIn(body: string): string[] {
	return [...new Set([...body.matchAll(/data-harness-component="([^"]+)"/g)].map((m) => m[1]))];
}

/** The text a reader sees, with the markup and the render marks taken away. */
function wordsIn(body: string): string {
	return body
		.replace(/<!--.*?-->/gs, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

const layouts = {
	appLayout: '/harness/branch/main/commit/3f9c2a1/layouts/app.layout.default/details',
	appLayoutSource: '/harness/branch/main/commit/3f9c2a1/layouts/app.layout.default/details?tab=source'
};

test('Renders the layout details route in the Harness console', () => {
	const cases = [layouts.appLayout, layouts.appLayoutSource].map((path) => {
		address.url = new URL(`http://localhost${path}`);
		const { body, head } = render(Page, { props: {} });
		return {
			name: `a layout details route at ${path.slice(0, 120)}`,
			input: { path },
			output: {
				title: /<title>([^<]*)<\/title>/.exec(head)?.[1] ?? null,
				components: componentsIn(body).slice(0, 8),
				text: wordsIn(body).slice(-80)
			}
		};
	});
	recordExampleCases(where('renders-the-layout-details-route-in-the-harness-console'), cases);

	const [first] = cases;
	expect(first.output.components).toContain('harness-harness-console');
	expect(first.output.components).toContain('harness-harness-header');
	// The page names EntityDetailsScreen as the content of its HarnessScreen. The server render
	// draws the console while its content loads on the client, so the content is read from the
	// page's own source here.
	const source = readFileSync(
		join(
			import.meta.dirname,
			'../../src/routes/harness/branch/[branch]/[...at]/layouts/[entity]/details/+page.svelte'
		),
		'utf8'
	);
	expect(source).toContain('content={EntityDetailsScreen}');
	expect(source).toContain('HarnessScreen title="Layout details"');
});

test('Titles the layout details page Layout details', () => {
	const cases = [layouts.appLayout, layouts.appLayoutSource].map((path) => {
		address.url = new URL(`http://localhost${path}`);
		const { head } = render(Page, { props: {} });
		return {
			name: `the title of the page at ${path.slice(0, 120)}`,
			input: { path },
			output: { title: /<title>([^<]*)<\/title>/.exec(head)?.[1] ?? null }
		};
	});
	recordExampleCases(where('titles-the-layout-details-page-layout-details'), cases);

	for (const { output } of cases) expect(output.title).toBe('Layout details · Harness');
});
