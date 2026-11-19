import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { entitySearch } from '../../src/utils/explorer-ui/entitySearch';
import type { SearchEntry } from '../../src/utils/explorer-ui/entitySearch';

type Cases = Parameters<typeof recordExampleCases>[1];
const unitId = 'reports.function.entity-search';
const record = (state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol: 'entitySearch', state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
const commit = 'a'.repeat(40);
const other = 'b'.repeat(40);

/** An entry as a caller passes it: a category may be unknown, the way a stale host sends one. */
function entry(
	id: string,
	category: string,
	name: string,
	purpose: string,
	terms: string[] = [],
	at = commit
): SearchEntry {
	return { id, category, name, purpose, terms, commit: at } as unknown as SearchEntry;
}
const ids = (found: SearchEntry[]) => found.map((item) => item.id);
const error = (thrown: unknown) => String(thrown);

test('Name and id matches rank above id parts, name words, substrings, purposes and terms', () => {
	const tiers = [
		entry('app.tax.rules', 'functions', 'Tax', 'Tax math.', ['order.total']),
		entry('app.component.reorder-tool', 'components', 'Reorder tool', 'Moves rows.'),
		entry('app.page.order', 'pages', 'Order', 'Lists rows.'),
		entry('app.shell.order-frame', 'layouts', 'Order frame', 'Frames pages.'),
		entry('app.component.order-list', 'components', 'Table of rows', 'Shows rows.'),
		entry('app.function.format', 'functions', 'Format order time', 'Times rows.'),
		entry('app.function.shipping', 'functions', 'Shipping rules', 'Applies to each order.')
	];
	const found = entitySearch(tiers, 'order');
	// Scores: name 100, name prefix 80, id part prefix 70, name word prefix 60, substring 40,
	// purpose 20, term 10.
	expect(ids(found)).toEqual([
		'app.page.order',
		'app.shell.order-frame',
		'app.component.order-list',
		'app.function.format',
		'app.component.reorder-tool',
		'app.function.shipping',
		'app.tax.rules'
	]);
	record('tiers-rank-names-and-ids-first', [
		{ name: 'order', input: { query: 'order', entries: ids(tiers) }, output: ids(found) }
	]);
});

test('Every query word has to match, and the best tier of each word adds to the score', () => {
	const pair = [
		entry('app.component.order-list', 'components', 'Order list', 'Lists rows.'),
		entry('app.component.order-table', 'components', 'Table of rows', 'Shows the order list.'),
		entry('app.component.order-summary', 'components', 'Order summary', 'Shows orders only.')
	];
	const found = entitySearch(pair, 'order list');
	// First: name prefix 80 plus name word prefix 60 = 140. Second: id part 70 plus purpose 20 = 90.
	// Third matches "order" but never "list", so it is left out.
	expect(ids(found)).toEqual(['app.component.order-list', 'app.component.order-table']);
	expect(entitySearch(pair, 'order missing')).toEqual([]);
	record('every-word-must-match-and-scores-add-up', [
		{ name: 'order list', input: { query: 'order list' }, output: ids(found) },
		{ name: 'order missing', input: { query: 'order missing' }, output: [] }
	]);
});

test('Matching ignores letter case, mixed case in terms and extra whitespace', () => {
	const pair = [
		entry('app.component.order-list', 'components', 'Order list', 'Lists rows.'),
		entry('app.component.order-table', 'components', 'Table of rows', 'Shows the order list.')
	];
	const spaced = entitySearch(pair, ' \tORDER   List\n');
	const termed = entitySearch(
		[entry('app.function.tax', 'functions', 'Tax', 'Tax math.', ['Order.Total'])],
		'ORDER.total'
	);
	expect(ids(spaced)).toEqual(['app.component.order-list', 'app.component.order-table']);
	expect(ids(termed)).toEqual(['app.function.tax']);
	record('matching-ignores-case-and-extra-whitespace', [
		{ name: 'mixed case with tabs and newlines', input: ' \tORDER   List\n', output: ids(spaced) },
		{ name: 'mixed-case term', input: 'ORDER.total', output: ids(termed) }
	]);
});

test('Equal scores keep category order, then name order, and unknown categories come last', () => {
	const tied = [
		entry('app.function.zed', 'functions', 'Zed tool', 'Runs.'),
		entry('app.service.able', 'services', 'Able tool', 'Runs.'),
		entry('app.page.bcd', 'pages', 'Bcd tool', 'Runs.'),
		entry('app.page.able', 'pages', 'Able tool', 'Runs.'),
		entry('app.other.aaa', 'nowhere', 'Aaa tool', 'Runs.')
	];
	const found = entitySearch(tied, 'tool');
	// All five match the name word "tool" at 60. Category order is pages, layouts, components,
	// functions, then services; inside pages the name decides, and "nowhere" is unknown so it is last.
	expect(ids(found)).toEqual([
		'app.page.able',
		'app.page.bcd',
		'app.function.zed',
		'app.service.able',
		'app.other.aaa'
	]);
	record('ties-keep-category-then-name-order-with-unknown-last', [
		{ name: 'tool', input: { query: 'tool', entries: ids(tied) }, output: ids(found) }
	]);
});

test('A blank query returns an empty array without reading any entry', () => {
	const malformed = [{ id: 'app.broken', category: 'pages' }] as unknown as SearchEntry[];
	const valid = [entry('app.page.order', 'pages', 'Order', 'Lists rows.')];
	const blankQueries = ['', '   ', '\t\n'];
	const outputs = blankQueries.map((query) => entitySearch(valid, query));
	// Malformed entries never reach the scoring, because the blank query returns first.
	const withMalformed = entitySearch(malformed, '   ');
	expect(outputs).toEqual([[], [], []]);
	expect(withMalformed).toEqual([]);
	record('blank-query-returns-nothing-even-with-malformed-entries', [
		{ name: 'empty text', input: '', output: outputs[0] },
		{ name: 'spaces only', input: '   ', output: outputs[1] },
		{ name: 'tab and newline only', input: '\t\n', output: outputs[2] },
		{ name: 'spaces with malformed entries', input: '   ', output: withMalformed }
	]);
});

test('Results are the same objects that were passed in and the input is not changed', () => {
	const entries = [
		entry('app.page.order', 'pages', 'Order', 'Lists rows.', [], commit),
		entry('app.component.order-list', 'components', 'Order list', 'Lists rows.', [], other)
	];
	const before = structuredClone(entries);
	const found = entitySearch(entries, 'order');
	expect(found).toHaveLength(2);
	expect(found[0]).toBe(entries[0]);
	expect(found[1]).toBe(entries[1]);
	expect(found.map((item) => item.commit)).toEqual([commit, other]);
	expect(entries).toEqual(before);
	record('results-are-the-passed-entries-unchanged', [
		{
			name: 'order',
			input: { query: 'order' },
			output: found.map((item) => ({ id: item.id, commit: item.commit, same: true }))
		}
	]);
});

test('The limit slices the ranked results, with zero and negative values', () => {
	const rows = Array.from({ length: 25 }, (_, index) =>
		entry(`app.function.row-${index}`, 'functions', `Row ${index}`, '')
	);
	const full = entitySearch(rows, 'row', 100);
	const byDefault = entitySearch(rows, 'row');
	const twoOnly = entitySearch(rows, 'row', 2);
	const none = entitySearch(rows, 'row', 0);
	const allButLastTwo = entitySearch(rows, 'row', -2);
	expect(full).toHaveLength(25);
	expect(ids(byDefault)).toEqual(ids(full.slice(0, 20)));
	expect(ids(twoOnly)).toEqual(ids(full.slice(0, 2)));
	expect(none).toEqual([]);
	expect(ids(allButLastTwo)).toEqual(ids(full.slice(0, -2)));
	record('limit-slices-ranked-results', [
		{ name: 'omitted limit', input: { query: 'row' }, output: ids(byDefault) },
		{ name: 'limit 2', input: { query: 'row', limit: 2 }, output: ids(twoOnly) },
		{ name: 'limit 0', input: { query: 'row', limit: 0 }, output: ids(none) },
		{ name: 'limit -2', input: { query: 'row', limit: -2 }, output: ids(allButLastTwo) }
	]);
});

test('Entries missing a string name, purpose or term throw a TypeError when a query reads them', () => {
	const base = entry('app.page.order', 'pages', 'Order', 'Lists rows.');
	const missingTerms = { ...base, terms: undefined } as unknown as SearchEntry;
	const nullName = { ...base, name: null } as unknown as SearchEntry;
	const missingPurpose = { ...base, purpose: undefined } as unknown as SearchEntry;
	const numberTerm = { ...base, terms: [7] } as unknown as SearchEntry;
	const thrown = [missingTerms, nullName, missingPurpose, numberTerm].map((bad) => {
		try {
			entitySearch([bad], 'order');
			return 'returned';
		} catch (caught) {
			expect(caught).toBeInstanceOf(TypeError);
			return error(caught);
		}
	});
	expect(thrown.every((message) => message.startsWith('TypeError'))).toBe(true);
	record('malformed-entries-throw-when-read', [
		{ name: 'missing terms', input: 'terms undefined', error: thrown[0] },
		{ name: 'null name', input: 'name null', error: thrown[1] },
		{ name: 'missing purpose', input: 'purpose undefined', error: thrown[2] },
		{ name: 'number term', input: 'terms [7]', error: thrown[3] }
	]);
});
