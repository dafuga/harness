import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { searchContracts } from '../../src/commands/development-tooling/contracts-command/searchContracts';

type Entry = Parameters<typeof searchContracts>[0][number];

const META = {
	unitId: 'command.development-tooling-contracts-command-search-contracts',
	symbol: 'searchContracts',
	evidence: 'examples-cases'
};

function entry(id: string, title: string, responsibility: string, contract: Record<string, string> = {}): Entry {
	return {
		id,
		kind: 'command',
		title,
		path: `src/${id}`,
		contractPath: `specification/units/${id}.json`,
		responsibility,
		manifest: { contract, helperContracts: {}, dependencies: {}, scenarios: {}, owns: [] },
		states: []
	} as unknown as Entry;
}

function summarise(matches: ReturnType<typeof searchContracts>) {
	return matches.map((match) => ({
		id: match.id,
		field: match.field,
		score: match.score,
		snippet: match.snippet
	}));
}

test('Ranks identity matches before descriptive matches', () => {
	const entries = [
		entry('contracts.list', 'List search results', 'Lists contracts'),
		entry('contracts.search', 'Search', 'Finds things')
	];
	const matches = searchContracts(entries, 'search', { ignoreCase: true });

	expect(matches.map((match) => match.id)).toEqual(['contracts.search', 'contracts.list']);
	expect(matches.map((match) => match.field)).toEqual(['id', 'title']);
	expect(matches.map((match) => match.score)).toEqual([600, 500]);
	recordExampleCases(
		{ ...META, state: 'ranks-identity-matches-before-descriptive-matches', file: 'ranks-identity-matches-before-descriptive-matches.json' },
		[
			{
				name: 'case-insensitive literal query matching an id and a title',
				input: { entries: entries.map((item) => item.id), query: 'search', options: { ignoreCase: true } },
				output: summarise(matches)
			}
		]
	);
});

test('Returns a bounded snippet with ellipses around the match', () => {
	const long = entry('contracts.long', 'Long', `${'a'.repeat(100)}needle${'b'.repeat(200)}`);
	const matches = searchContracts([long], 'needle', {});
	const expected = `…${'a'.repeat(45)}needle${'b'.repeat(109)}…`;

	expect(matches).toHaveLength(1);
	expect(matches[0]?.field).toBe('responsibility');
	expect(matches[0]?.snippet).toBe(expected);
	expect(matches[0]?.snippet.length).toBe(162);
	recordExampleCases(
		{ ...META, state: 'returns-a-bounded-snippet-with-ellipses-around-the-match', file: 'returns-a-bounded-snippet-with-ellipses-around-the-match.json' },
		[
			{
				name: 'literal match deep inside a 306-character responsibility',
				input: { entries: [long.id], query: 'needle', options: {} },
				output: summarise(matches)
			}
		]
	);
});

test('Matches regular expressions ignoring case', () => {
	const invoice = entry('billing.invoice', 'Invoice', 'Invoice INV-123 is paid');
	const refund = entry('billing.refund', 'Refund', 'Refunds money');
	const options = { regex: true, ignoreCase: true };
	const matches = searchContracts([invoice, refund], 'inv-\\d{3}', options);

	expect(matches.map((match) => match.id)).toEqual(['billing.invoice']);
	expect(matches[0]?.snippet).toBe('Invoice INV-123 is paid');
	expect(matches[0]?.score).toBe(400);
	recordExampleCases(
		{ ...META, state: 'matches-regular-expressions-ignoring-case', file: 'matches-regular-expressions-ignoring-case.json' },
		[
			{
				name: 'case-insensitive pattern inv-\\d{3} over two billing contracts',
				input: { entries: [invoice.id, refund.id], query: 'inv-\\d{3}', options },
				output: summarise(matches)
			}
		]
	);
});

test('Rejects an empty search query', () => {
	const message = 'Contract search query must not be empty.';

	expect(() => searchContracts([entry('contracts.search', 'Search', 'Finds')], '', {})).toThrow(message);
	recordExampleCases(
		{ ...META, state: 'rejects-an-empty-search-query', file: 'rejects-an-empty-search-query.json' },
		[
			{
				name: 'empty query against one stored contract',
				input: { entries: ['contracts.search'], query: '', options: {} },
				error: message
			}
		]
	);
});

test('Rejects an uncompilable regular expression', () => {
	const message = 'Invalid regular expression: (';
	const entries = [entry('contracts.search', 'Search', 'Finds')];

	expect(() => searchContracts(entries, '(', { regex: true })).toThrow(message);
	recordExampleCases(
		{ ...META, state: 'rejects-an-uncompilable-regular-expression', file: 'rejects-an-uncompilable-regular-expression.json' },
		[
			{
				name: 'unclosed group in regex mode',
				input: { entries: ['contracts.search'], query: '(', options: { regex: true } },
				error: message
			}
		]
	);
});

test('Caps results at the requested limit', () => {
	const entries = [
		entry('contracts.a', 'Search', 'Finds'),
		entry('contracts.b', 'Search', 'Finds'),
		entry('contracts.c', 'Search', 'Finds')
	];
	const matches = searchContracts(entries, 'Search', { limit: 2 });

	expect(matches.map((match) => match.id)).toEqual(['contracts.a', 'contracts.b']);
	expect(matches.every((match) => match.score === 560)).toBe(true);
	recordExampleCases(
		{ ...META, state: 'caps-results-at-the-requested-limit', file: 'caps-results-at-the-requested-limit.json' },
		[
			{
				name: 'three equal-score matches with limit 2 keep the first two ids',
				input: { entries: entries.map((item) => item.id), query: 'Search', options: { limit: 2 } },
				output: summarise(matches)
			}
		]
	);
});
