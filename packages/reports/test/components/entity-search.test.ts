import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntitySearch from '../../src/components/EntitySearch.svelte';
import type { SearchEntry } from '../../src/utils/entitySearch';

/**
 * The field of the shared search before anything is typed: a closed combobox that says what it
 * searches. Its results are drawn only once a query is typed, never on a page that is just served.
 */
const entries: SearchEntry[] = [
	{
		id: 'app.page.orders',
		category: 'pages',
		name: 'Orders',
		purpose: '',
		terms: [],
		commit: 'a'.repeat(40)
	}
];
const drawn = (props: object) =>
	render(EntitySearch, {
		props: {
			entries,
			scope: { label: 'At the tip', pinned: null },
			href: () => '/',
			open: () => {},
			...props
		}
	}).body.replace(/<!--.*?-->/gs, '');
test('global search starts as a single icon button with its query inside a closed modal', () => {
	const html = drawn({});
	expect(html).toMatch(/aria-label="Search entities"/);
	expect(html).not.toMatch(/role="combobox"|role="listbox"|<input\b/);
	expect(html).toMatch(/aria-haspopup="dialog"/);
});
