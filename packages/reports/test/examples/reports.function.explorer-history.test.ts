import { test } from 'vitest';
import type { ExplorerScope } from '../../src/models/explorer-ui/Explorer.types';
import { historyDetail } from '../../src/components/explorer-ui/entity-history/explorerHistory';
import { explorerHistory } from '../../src/utils/explorer-ui/explorer-history/explorerHistory';
import { index, record, revision } from '../entityFixture';
import { scope } from '../entityPlaces';
import { commits, ids, sha } from '../entityUnits';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * Both symbols are called the way the explorer calls them, over the loaded fixture history: the
 * selected commit and its ancestry, a commit the index does not hold, and one stored revision.
 * Each state records one symbol, with the input it was given and the result it returned.
 */

type Cases = Parameters<typeof recordExampleCases>[1];
const unitId = 'reports.function.explorer-history';
const trace = (symbol: string, state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
const unknownScope = (): ExplorerScope => ({
	...scope('commit'),
	commit: sha('f'),
	atTip: false,
	parent: null
});
const rowsOf = (at: ExplorerScope, unit: string) => explorerHistory(index, at, unit);
const commitsOf = (list: ReturnType<typeof rowsOf>) => list.map((row) => row.commit);

test('the history of a unit lists its changing commits newest first, from the selected commit', () => {
	const fromMiddle = rowsOf(scope('commit'), ids.filter);
	const fromTip = rowsOf(scope('current'), ids.filter);
	expect(fromMiddle.map((row) => [row.commit, row.change])).toEqual([
		[commits.middle, 'direct'],
		[commits.first, 'added']
	]);
	expect(commitsOf(fromTip)).toEqual([commits.middle, commits.first]);
	expect(JSON.stringify(fromTip)).not.toContain(commits.tip);
	trace('explorerHistory', 'loaded-history-newest-first-from-selected-commit', [
		{
			name: 'filter history from the middle commit lists it and its first parent',
			input: { scope: 'commit', unit: ids.filter },
			output: fromMiddle
		},
		{
			name: 'filter history from the tip skips the tip, which changed nothing of it',
			input: { scope: 'current', unit: ids.filter },
			output: fromTip
		}
	]);
});

test('a missing commit or a unit no revision names has no history rows', () => {
	const missing = rowsOf(unknownScope(), ids.filter);
	const unnamed = rowsOf(scope('current'), 'app.function.never');
	expect(missing).toEqual([]);
	expect(unnamed).toEqual([]);
	trace('explorerHistory', 'missing-commit-or-unnamed-unit-has-no-rows', [
		{
			name: 'a commit the index does not hold has an empty history',
			input: { scope: 'missing', unit: ids.filter },
			output: missing
		},
		{
			name: 'a unit no revision names has an empty history',
			input: { scope: 'current', unit: 'app.function.never' },
			output: unnamed
		}
	]);
});

test('a row keeps its measurement, its size change from the measured ancestor, and its reviews', () => {
	const [grown, first] = rowsOf(scope('commit'), ids.filter);
	expect(grown).toMatchObject({
		commit: commits.middle,
		previous: commits.first,
		sizeChange: 200,
		complexityChange: -1,
		measured: { record: 'r2', size: 1200, complexity: 2 }
	});
	expect(first).toMatchObject({ previous: null, sizeChange: null, complexityChange: null });
	expect(first.measured).toMatchObject({ record: 'r1', size: 1000, complexity: 3 });
	expect(grown.reviews.map((item) => item.type)).toEqual(['approval']);
	trace('explorerHistory', 'row-measures-its-change-from-the-measured-ancestor', [
		{
			name: 'the middle row is 200 bytes larger and one complexity lower than its parent',
			input: { scope: 'commit', unit: ids.filter, row: commits.middle },
			output: grown
		},
		{
			name: 'the first row has no earlier measurement to compare with',
			input: { scope: 'commit', unit: ids.filter, row: commits.first },
			output: first
		}
	]);
});

test('a stored revision gives the exact detail of a unit at its commit', () => {
	const head = revision(commits.middle, [record(commits.middle)]);
	const filter = historyDetail(head, ids.filter);
	const card = historyDetail(head, ids.card);
	expect(filter).toMatchObject({
		known: true,
		present: true,
		change: 'direct',
		explanations: [{ unit: ids.filter, symbol: 'filterOrders' }],
		verdict: expect.anything()
	});
	expect(card).toMatchObject({ known: true, present: true, change: null });
	trace('historyDetail', 'exact-revision-detail-of-a-unit-at-its-commit', [
		{
			name: 'a unit the commit changed directly has its explanation and verdict',
			input: { commit: commits.middle, unit: ids.filter },
			output: filter
		},
		{
			name: 'a unit the commit left alone is present with no change',
			input: { commit: commits.middle, unit: ids.card },
			output: card
		}
	]);
});

test('an absent unit or a revision without a registry has no version or verdict', () => {
	const head = revision(commits.middle, [record(commits.middle)]);
	const absent = historyDetail(head, 'app.function.never');
	const blind = historyDetail(
		{ ...head, registry: { ...head.registry, available: false } },
		ids.filter
	);
	expect(absent).toMatchObject({ present: false, version: null, verdict: null, change: null });
	expect(blind).toMatchObject({ known: false, present: true });
	trace('historyDetail', 'absent-unit-or-unknown-registry-has-no-version', [
		{
			name: 'a unit the registry does not hold has no version or verdict',
			input: { commit: commits.middle, unit: 'app.function.never' },
			output: absent
		},
		{
			name: 'a revision whose registry is unavailable is not known',
			input: { commit: commits.middle, unit: ids.filter, registry: 'unavailable' },
			output: blind
		}
	]);
});
