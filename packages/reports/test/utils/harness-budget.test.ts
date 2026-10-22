import { expect, test } from 'vitest';
import { harnessBudget } from '../../src/utils/harnessBudget';
import { harnessGrowth, unitTimings } from '../../src/utils/harnessGrowth';
import { history, sha, summary } from '../explorerFixture';

const base = { unit: 'kernel.counter', workload: null, profile: null };

test('growth is chronological and unavailable values never produce invented zero deltas', () => {
	const index = history({
		revisions: [summary(sha('c')), summary(sha('b')), summary(sha('a'))],
		units: [
			{
				id: 'component.list',
				growth: [
					{ commit: sha('c'), record: 'c', 'source-bytes': 90, complexity: 2 },
					{ commit: sha('a'), record: 'a', 'source-bytes': 100, complexity: 0 },
					{ commit: sha('b'), record: 'b', 'source-bytes': 120 }
				]
			}
		],
		benchmarks: [
			{
				unit: 'component.list',
				workload: 'cold',
				metric: 'latency',
				target: 'module',
				incompatible: false,
				series: []
			},
			{
				unit: 'component.list',
				workload: 'warm',
				metric: 'latency',
				target: 'module',
				incompatible: true,
				series: []
			},
			{
				unit: 'component.other',
				workload: 'cold',
				metric: 'latency',
				target: 'module',
				incompatible: false,
				series: []
			}
		]
	});
	const rows = harnessGrowth(index, 'component.list');
	expect(rows.map((row) => row.commit)).toEqual([sha('a'), sha('b'), sha('c')]);
	expect(rows.map((row) => row.deltas['source-bytes'])).toEqual([undefined, 20, -30]);
	expect(rows.map((row) => row.deltas.complexity)).toEqual([undefined, undefined, undefined]);
	expect(
		unitTimings(index, 'component.list').map((item) => [item.workload, item.incompatible])
	).toEqual([
		['cold', false],
		['warm', true]
	]);
});
const measured = (value: number | null, extra: object = {}) => ({
	...base,
	metric: 'complexity',
	unitOfMeasure: 'points',
	value,
	...extra
});
const finding = (status: string, baseline: number | null) => ({
	unit: 'kernel.counter',
	metric: 'complexity',
	status,
	baseline,
	measured: null
});

test('a metric that cannot be measured reads as unavailable and not frozen, never as zero', () => {
	const reason = 'Decision points are not counted in Rust: crates/counter/src/lib.rs.';
	const line = harnessBudget(measured(null, { unavailable: reason }), finding('unavailable', null));
	expect(line).toEqual({
		value: `unavailable: ${reason}`,
		limit: 'not frozen: reviewed as not measurable'
	});
	expect(harnessBudget(measured(null, { unavailable: reason })).limit).toBe(
		'not frozen: no value to freeze'
	);
});

test('a counted zero is a value with a limit, and a partial value says what it leaves out', () => {
	expect(harnessBudget(measured(0), finding('passed', 0))).toEqual({
		value: '0 points',
		limit: 'frozen at 0'
	});
	const partial = 'Counted in 1 of 2 code files. Decision points are not counted in Rust: lib.rs.';
	expect(harnessBudget(measured(3, { partial }), finding('passed', 3))).toEqual({
		value: '3 points',
		limit: 'frozen at 3',
		note: `Partial: ${partial}`
	});
});

const unreviewed = 'freeze declared; no reviewed limit is recorded at this revision';

test('a declared freeze is not a limit: without a reviewed number the line says none is recorded', () => {
	// The first record of a repository: measured, judged, and no baseline to judge it against.
	expect(harnessBudget(measured(12), finding('missing-baseline', null))).toEqual({
		value: '12 points',
		limit: unreviewed
	});
	expect(harnessBudget(undefined)).toEqual({
		value: 'not measured at this revision',
		limit: unreviewed
	});
	expect(harnessBudget(measured(12), undefined, { declared: false }).limit).toBe(
		'no limit is recorded at this revision'
	);
	// What cannot be measured keeps its own wording, whatever is declared.
	const reason = 'Decision points are not counted in Rust: lib.rs.';
	expect(
		harnessBudget(measured(null, { unavailable: reason }), finding('missing-baseline', null)).limit
	).toBe('not frozen: no value to freeze');
});

test('a reviewed limit is shown with its number: the one the record judged against, else the ledger of the revision', () => {
	const ledger = { declared: true, limit: 9 };
	// Not judged in this record, but the ledger of the revision holds a limit for it.
	expect(harnessBudget(undefined, undefined, ledger)).toEqual({
		value: 'not measured at this revision',
		limit: 'frozen at 9'
	});
	expect(harnessBudget(measured(7), undefined, ledger).limit).toBe('frozen at 9');
	// The record's own finding says what it was held against, and what came of it.
	expect(harnessBudget(measured(12), { ...finding('exceeded', 3), measured: 12 }, ledger)).toEqual({
		value: '12 points',
		limit: 'frozen at 3',
		note: 'Grew from 3 to 12 without a recorded approval.'
	});
	const stated = { declared: true, unmeasured: 'No parser was installed.' };
	expect(harnessBudget(measured(7), undefined, stated).limit).toBe(
		'not frozen: reviewed as not measurable'
	);
});
