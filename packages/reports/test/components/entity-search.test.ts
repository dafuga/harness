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
const field = (html: string) => /<input\b[^>]*>/s.exec(html)?.[0] ?? '';

test('the field is a closed combobox for entities with nothing listed', () => {
	const html = drawn({});
	expect(field(html)).toMatch(/role="combobox"/);
	expect(field(html)).toMatch(/aria-expanded="false"/);
	expect(field(html)).toMatch(/placeholder="Search entities"/);
	expect(html).not.toMatch(/role="listbox"|role="option"/);
});

test('a selected commit is named, also while its entities are read; otherwise loading is said', () => {
	const pinned = { label: 'At commit ccccccc', pinned: 'ccccccc' };
	expect(field(drawn({ scope: pinned }))).toMatch(/placeholder="Search at ccccccc"/);
	expect(field(drawn({ scope: pinned, entries: null }))).toMatch(/placeholder="Search at ccccccc"/);
	expect(field(drawn({ entries: null }))).toMatch(/placeholder="Loading entities…"/);
});
