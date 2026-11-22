import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	entityHistory,
	historyListed,
	historyProfiles
} from '../../src/components/explorer-ui/entity-history/entityHistory';
import { explorerHistory } from '../../src/utils/explorer-ui/explorer-history/explorerHistory';
import { historyDetail } from '../../src/components/explorer-ui/entity-history/explorerHistory';
import { index, record, revision } from '../entityFixture';
import { answers, view } from '../entityPlaces';
import { commits, ids } from '../entityUnits';

type Cases = Parameters<typeof recordExampleCases>[1];
const unitId = 'reports.function.entity-history';
const traced = (symbol: string, state: string, cases: Cases) => {
	const file = `${state}.json`;
	return recordExampleCases({ unitId, symbol, state, evidence: 'examples-cases', file }, cases);
};

const rows = answers(view('commit'), ids.filter).history;
const none = new Map();

test('A listed commit carries its series point, beside the value of the listed commit before it', () => {
	const timings = entityHistory(index, ids.filter, rows);
	expect([...timings.keys()]).toEqual([commits.middle, commits.first]);
	expect(timings.get(commits.middle)).toEqual([
		{
			profile: 'bun-reference',
			workload: 'thousand-orders',
			metric: 'p95-ms',
			target: null,
			unit: 'ms',
			before: 0.15,
			after: 0.12
		},
		{
			profile: 'ci-linux',
			workload: 'thousand-orders',
			metric: 'p95-ms',
			target: null,
			unit: 'ms',
			after: 0.31
		}
	]);
	expect(timings.get(commits.first)).toEqual([
		{
			profile: 'bun-reference',
			workload: 'thousand-orders',
			metric: 'p95-ms',
			target: null,
			unit: 'ms',
			after: 0.15
		}
	]);
	traced('entityHistory', 'history-timings-projected', [
		{
			name: 'filter timings: middle with before from first, ci-linux with none; first with none',
			input: { unit: ids.filter, rows: rows.map(({ commit }) => commit) },
			output: [...timings]
		}
	]);
});

test('Source-only and unbenchmarked units have no history timings, and no row is read past the last', () => {
	const sourceOnly = entityHistory(index, ids.list, rows);
	const absent = entityHistory(index, ids.search, rows);
	expect(sourceOnly).toEqual(new Map());
	expect(absent).toEqual(new Map());
	expect(entityHistory(index, ids.filter, rows.slice(1))).toEqual(
		new Map([
			[
				commits.first,
				[
					{
						profile: 'bun-reference',
						workload: 'thousand-orders',
						metric: 'p95-ms',
						target: null,
						unit: 'ms',
						after: 0.15
					}
				]
			]
		])
	);
	traced('entityHistory', 'source-only-and-absent-history-empty', [
		{
			name: 'source-only unit (list) has no timings',
			input: { unit: ids.list, rows: rows.map(({ commit }) => commit) },
			output: [...sourceOnly]
		},
		{
			name: 'unit with no benchmark (search) has no timings',
			input: { unit: ids.search, rows: rows.map(({ commit }) => commit) },
			output: [...absent]
		}
	]);
});

test('Listed rows keep their given order, and unknown rows wait for a read to be listed or unread', () => {
	const reversed = [...rows].reverse();
	expect(historyListed(reversed, none).listed.map((row) => row.commit)).toEqual([
		commits.first,
		commits.middle
	]);
	const older = {
		...index,
		revisions: index.revisions.map(({ changes: _changes, ...kept }) => kept)
	};
	const unknown = explorerHistory(older, view('commit').scope, ids.list).reverse();
	const first = revision(commits.first, [record(commits.first)]);
	const read = new Map([[commits.first, historyDetail(first, ids.list)]]);
	const found = historyListed(unknown, read);
	expect(found.listed.map((row) => row.commit)).toEqual([commits.first]);
	expect(found.unread.map((row) => row.commit)).toEqual([commits.middle]);
	traced('historyListed', 'listed-rows-keep-given-order', [
		{
			name: 'reversed history rows stay in the given order',
			input: { rows: reversed.map(({ commit }) => commit), read: [] },
			output: historyListed(reversed, none)
		},
		{
			name: 'unknown rows: read direct change listed, unread row kept in order',
			input: { rows: unknown.map(({ commit }) => commit), read: [commits.first] },
			output: found
		}
	]);
});

test('Profiles are listed once each, in the order their timings first occur', () => {
	const timings = entityHistory(index, ids.filter, rows);
	const [bun, ci] = [timings.get(commits.middle)![0], timings.get(commits.middle)![1]];
	expect(historyProfiles(timings)).toEqual(['bun-reference', 'ci-linux']);
	const reordered = new Map([
		[commits.tip, [ci, bun]],
		[commits.first, [bun]]
	]);
	expect(historyProfiles(reordered)).toEqual(['ci-linux', 'bun-reference']);
	traced('historyProfiles', 'profiles-in-first-occurrence-order', [
		{
			name: 'timings from the filter history',
			input: { timings: [...timings] },
			output: historyProfiles(timings)
		},
		{
			name: 'ci-linux first in the map, bun-reference repeated',
			input: { timings: [...reordered] },
			output: historyProfiles(reordered)
		}
	]);
});
