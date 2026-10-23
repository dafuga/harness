import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntitySearchResults from '../../src/components/EntitySearchResults.svelte';
import type { SearchEntry } from '../../src/utils/entitySearch';

/**
 * The results of the shared search: each one a link with a readable category, its name and its
 * purpose; the active one marked; loading and nothing found said in words.
 */
const commit = 'a'.repeat(40);
const found: SearchEntry[] = [
	{
		id: 'app.shell.order-frame',
		category: 'layouts',
		name: 'Order frame',
		purpose: 'Frames the order pages.',
		terms: [],
		commit
	},
	{
		id: 'app.service.refunds',
		category: 'services',
		name: 'Refund service',
		purpose: '',
		terms: ['amountInCents'],
		commit
	}
];
const drawn = (props: object) =>
	render(EntitySearchResults, {
		props: {
			...{ id: 'search-list', found, active: 1, loading: false, query: 'r', scope: 'At the tip' },
			...{ shift: 0, href: (entry: SearchEntry) => `/at/${entry.id}`, choose: () => {}, ...props }
		}
	}).body.replace(/<!--.*?-->/gs, '');
const text = (html: string) =>
	html
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
const options = (html: string) =>
	[...html.matchAll(/<li\b([^>]*)>(.*?)<\/li>/gs)].map(([, attributes, inner]) => ({
		id: /id="([^"]*)"/.exec(attributes)?.[1],
		selected: /aria-selected="true"/.test(attributes),
		href: /href="([^"]*)"/.exec(inner)?.[1],
		text: text(inner)
	}));

test('each result is a link with its category, name and purpose, and the active one is selected', () => {
	const html = drawn({});
	expect(html).toMatch(
		/<ul\b[^>]*id="search-list"[^>]*role="listbox"[^>]*aria-label="Entities found"/
	);
	expect(options(html)).toEqual([
		{
			id: 'search-list-0',
			selected: false,
			href: '/at/app.shell.order-frame',
			text: 'Layout Order frame Frames the order pages.'
		},
		{
			id: 'search-list-1',
			selected: true,
			href: '/at/app.service.refunds',
			text: 'Service Refund service'
		}
	]);
	expect(text(html)).toContain('At the tip');
});

test('loading and an empty search are said, with no result offered', () => {
	expect(options(drawn({ found: [], loading: true }))).toEqual([]);
	expect(text(drawn({ found: [], loading: true }))).toContain('Loading entities…');
	expect(text(drawn({ found: [], query: 'zzz' }))).toContain('No entity matches “zzz”');
});
