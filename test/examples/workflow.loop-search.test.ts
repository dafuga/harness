import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { renderLoopSearchResults, searchLoops } from '../../src/cli/program/loopSearch';
import type { LoopSearchResult } from '../../src/cli/program/loopSearch.types';

const unitId = 'workflow.loop-search';

const rowsFixture: LoopSearchResult[] = [
	{
		kind: 'template',
		id: 'feature',
		title: 'Feature Delivery',
		summary: 'Spec, implement, test, and verify a user-facing or API feature.',
		source: 'built-in'
	},
	{
		kind: 'loop',
		id: 'password-reset',
		title: 'Add password reset to the login flow',
		summary: '2 of 4 steps complete.',
		source: 'project'
	}
];

const malformedRow: LoopSearchResult = {
	kind: 'loop',
	id: 'billing-export',
	title: 'Invalid persisted loop',
	summary: 'Persisted loop JSON is malformed; stored steps are unavailable.',
	source: 'project'
};

function writeLoopFile(root: string, name: string, content: string | undefined): void {
	const dir = join(root, 'specification', 'loops', name);
	mkdirSync(dir, { recursive: true });
	if (content !== undefined) writeFileSync(join(dir, 'loop.json'), content);
}

function record(
	state: string,
	symbol: string,
	cases: Array<{ name: string; input: unknown; output: unknown }>
): void {
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

test('Lists built-in templates for an empty project', async () => {
	await withTempDir('loop-search-empty-', async (root) => {
		const results = await searchLoops({ root });
		const loops = results.filter((result) => result.kind === 'loop');
		expect(loops).toEqual([]);
		expect(results.map((result) => result.id)).toContain('feature');
		expect(results.every((result) => result.source === 'built-in')).toBe(true);
		record('lists-built-in-templates-for-an-empty-project', 'searchLoops', [
			{
				name: 'empty project returns built-in templates and no loop rows',
				input: { root: '<temporary empty project>' },
				output: results.map((result) => ({
					kind: result.kind,
					id: result.id,
					source: result.source
				}))
			}
		]);
	});
});

test('Filters rows by a trimmed case-insensitive query', async () => {
	await withTempDir('loop-search-query-', async (root) => {
		const all = await searchLoops({ root });
		const blank = await searchLoops({ root, query: '   ' });
		const matched = await searchLoops({ root, query: '  FEATURE  ' });
		const missed = await searchLoops({ root, query: 'zzz-no-match' });
		expect(blank).toEqual(all);
		expect(matched.map((result) => result.id)).toContain('feature');
		expect(missed).toEqual([]);
		record('filters-rows-by-a-trimmed-case-insensitive-query', 'searchLoops', [
			{
				name: 'blank query returns every row',
				input: { query: '   ' },
				output: blank.length
			},
			{
				name: 'upper-case padded query matches the feature template',
				input: { query: '  FEATURE  ' },
				output: matched.map((result) => result.id)
			},
			{
				name: 'query with no match returns no rows',
				input: { query: 'zzz-no-match' },
				output: missed
			}
		]);
	});
});

test('Renders result rows as indented text blocks', () => {
	const text = renderLoopSearchResults(rowsFixture);
	expect(text).toBe(
		'template: feature\n  Feature Delivery\n  Spec, implement, test, and verify a user-facing or API feature.\n\nloop: password-reset\n  Add password reset to the login flow\n  2 of 4 steps complete.'
	);
	expect(text).not.toContain('built-in');
	record('renders-result-rows-as-indented-text-blocks', 'renderLoopSearchResults', [
		{
			name: 'two rows render kind, id, title and summary without source',
			input: { results: rowsFixture.map((row) => row.id) },
			output: text
		}
	]);
});

test('Renders the no-match message for no results', () => {
	const text = renderLoopSearchResults([]);
	expect(text).toBe('No loop templates or loop instances matched.');
	record('renders-the-no-match-message-for-no-results', 'renderLoopSearchResults', [
		{
			name: 'empty array returns the no-match message',
			input: { results: [] },
			output: text
		}
	]);
});

test('Skips loops without state and flags malformed JSON', async () => {
	await withTempDir('loop-search-malformed-', async (root) => {
		writeLoopFile(root, 'billing-export', '{ "name": ');
		writeLoopFile(root, 'draft-only', undefined);
		const loops = (await searchLoops({ root })).filter((result) => result.kind === 'loop');
		expect(loops).toEqual([malformedRow]);
		record('skips-loops-without-state-and-flags-malformed-json', 'searchLoops', [
			{
				name: 'malformed loop.json becomes a diagnostic row and a directory without loop.json is omitted',
				input: {
					root: '<temporary project>',
					loops: { 'billing-export': 'malformed JSON', 'draft-only': 'no loop.json' }
				},
				output: loops
			}
		]);
	});
});
