import { render } from 'svelte/server';
import { test, vi } from 'vitest';
import Page from '../../src/routes/harness/branch/[branch]/[...at]/components/[entity]/details/+page.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

// The address the page is at is held here, so each test names it as the browser would.
const location = vi.hoisted(() => ({ url: new URL('http://localhost/harness') }));

// The router state the explorer frame reads; a test sets the address before it renders.
vi.mock('$app/state', () => ({
	page: {
		get url() {
			return location.url;
		}
	}
}));
vi.mock('$app/navigation', () => ({ goto: () => Promise.resolve() }));

const commit = 'a'.repeat(40);
const entity = 'reports.component.harness-entity-details';

/** The evidence of one state: its cases, under the page and the function it renders. */
const where = (state: string) => ({
	unitId: 'reports.page.harness-branch-branch-at-components-entity-details',
	symbol: '+page',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** Renders the page at an address and returns its document title and the words it draws. */
function shownAt(href: string): { title: string; words: string; head: string } {
	location.url = new URL(href);
	const { head, body } = render(Page);
	const title = /<title>(.*?)<\/title>/s.exec(head)?.[1] ?? '';
	const words = body
		.replace(/<!--.*?-->/gs, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return { title, words, head };
}

test('Renders the component details page with the document title Component details · Harness', () => {
	const contract = `/harness/branch/main/components/${entity}/details`;
	const shown = shownAt(`http://localhost${contract}`);
	recordExampleCases(where('renders-the-component-details-page-with-the-document-title-c'), [
		{
			name: 'the details page of a component opened with no tab',
			input: { url: contract },
			output: { title: shown.title, words: shown.words }
		}
	]);
	expect(shown.title).toBe('Component details · Harness');
	expect(shown.head).toContain('<title>Component details · Harness</title>');
});

test('Renders the measurements and source tab addresses of a component without another revision content', () => {
	const at = `/harness/branch/main/commit/${commit}/components/${entity}/details`;
	const measured = shownAt(`http://localhost${at}?tab=measurements`);
	const source = shownAt(`http://localhost${at}?tab=source`);
	recordExampleCases(where('renders-the-measurements-and-source-tab-addresses-of-a-compo'), [
		{
			name: 'a commit address with the measurements tab, before the revision is read',
			input: { url: `${at}?tab=measurements` },
			output: { title: measured.title, words: measured.words }
		},
		{
			name: 'a commit address with the source tab, before the revision is read',
			input: { url: `${at}?tab=source` },
			output: { title: source.title, words: source.words }
		}
	]);
	expect(measured.title).toBe('Component details · Harness');
	expect(source.title).toBe('Component details · Harness');
	expect(measured.words).not.toContain('Measurements and frozen limits');
	expect(source.words).not.toContain('src/routes/');
});
