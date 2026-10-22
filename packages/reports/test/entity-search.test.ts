import { expect, test } from 'vitest';
import type { SearchEntry } from '../src/utils/entitySearch';
import { entitySearch } from '../src/components/entity-search/entitySearch';

/**
 * One search over the entities of one revision: every category, matched on display names, ids,
 * purposes and declared contract names, best matches of names and ids first.
 */
const commit = 'a'.repeat(40);
type Row = [
	id: string,
	category: SearchEntry['category'],
	name: string,
	purpose: string,
	terms?: string[]
];
function entry(row: Row): SearchEntry {
	const [id, category, name, purpose, terms = []] = row;
	return { id, category, name, purpose, terms, commit };
}
const rows: Row[] = [
	['app.page.orders', 'pages', 'Orders', 'Lists every order of a customer.'],
	['app.shell.order-frame', 'shells', 'Order frame', 'Frames the order pages.'],
	['app.component.order-list', 'components', 'OrderList', 'Shows orders in a table.'],
	[
		'app.function.format-time',
		'functions',
		'Format time',
		'Says how long ago an order was placed.',
		['placedAt', 'elapsed']
	],
	['app.config.titles', 'configs', 'Titles config', 'How long a title may be.', ['limit']],
	[
		'app.service.refunds',
		'services',
		'Refund service',
		'Pays back a refunded amount.',
		['amountInCents']
	]
];
const entries = rows.map(entry);
const ids = (query: string, limit?: number) =>
	entitySearch(entries, query, limit).map((found) => found.id);

test('a name that is the query comes first, then names starting with it, then other matches', () => {
	expect(ids('orders')).toEqual(['app.page.orders', 'app.component.order-list']);
	// Equal matches keep the order of the categories: pages, shells, components, functions.
	expect(ids('order')).toEqual([
		'app.page.orders',
		'app.shell.order-frame',
		'app.component.order-list',
		'app.function.format-time'
	]);
});

test('every category is searched, and an id or a part of it finds its entity', () => {
	expect(ids('app.')).toHaveLength(6);
	expect(ids('app.function.format')).toEqual(['app.function.format-time']);
	expect(ids('refund')).toEqual(['app.service.refunds']);
});

test('declared contract names are searched after names and purposes', () => {
	expect(ids('cents')).toEqual(['app.service.refunds']);
	expect(ids('elapsed')).toEqual(['app.function.format-time']);
});

test('every word of the query has to match, in any case', () => {
	expect(ids('ORDER table')).toEqual(['app.component.order-list']);
	expect(ids('order refund')).toEqual([]);
});

test('an empty query finds nothing, and no more than the limit is returned', () => {
	expect(ids('   ')).toEqual([]);
	expect(ids('app', 2)).toHaveLength(2);
});

test('each result is the entry it was found in, with its revision', () => {
	expect(entitySearch(entries, 'frame')).toEqual([entries[1]]);
});
