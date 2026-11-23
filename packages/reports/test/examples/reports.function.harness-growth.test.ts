import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	harnessGrowth,
	unitTimings
} from '../../src/components/explorer-ui/harness-growth/harnessGrowth';
import { growthMetrics, signed } from '../../src/utils/explorer-ui/harnessGrowth';
import type { GrowthMetric, GrowthRow } from '../../src/utils/explorer-ui/harnessGrowth.types';

const unit = 'reports.function.harness-growth';
const emptyIndex = () =>
	({
		branches: [],
		revisions: [],
		units: [],
		benchmarks: [],
		profiles: [],
		legacy: [],
		truncated: false,
		problems: []
	}) as Parameters<typeof harnessGrowth>[0];

function growthIndex() {
	return {
		...emptyIndex(),
		revisions: [
			{ commit: 'older', subject: 'Initial measurement', committedAt: '2026-01-01' },
			{ commit: 'newer', subject: 'Added dependencies', committedAt: '2026-01-02' }
		],
		units: [
			{
				id: unit,
				growth: [
					{ commit: 'newer', 'source-bytes': 120, complexity: 4, dependencies: 3 },
					{ commit: 'older', 'source-bytes': 100, complexity: 4, dependencies: 2 }
				]
			}
		]
	} as Parameters<typeof harnessGrowth>[0];
}

const growthSummary = (rows: GrowthRow[]) =>
	rows.map(({ commit, subject, values, deltas, changed }) => ({
		commit,
		subject,
		values,
		deltas,
		changed
	}));

function benchmark(unitId: string, workload: string) {
	return {
		unit: unitId,
		workload,
		metric: 'duration-ms',
		target: 'node',
		incompatible: false,
		series: []
	};
}

test('Builds growth rows with metric deltas', () => {
	const index = growthIndex();
	const rows = harnessGrowth(index, unit);
	const output = growthSummary(rows);
	expect(output.map((row) => [row.commit, row.deltas['source-bytes'], row.changed])).toEqual([
		['newer', undefined, false],
		['older', -20, true]
	]);
	recordExampleCases(
		{
			unitId: unit,
			symbol: 'harnessGrowth',
			state: 'builds-growth-rows-with-metric-deltas',
			evidence: 'examples-cases',
			file: 'builds-growth-rows-with-metric-deltas.json'
		},
		[
			{
				name: 'orders measured commits and computes changes',
				input: { unit, points: index.units[0].growth },
				output
			}
		]
	);
});

test('Keeps matching benchmark conditions separate', () => {
	const index = {
		...emptyIndex(),
		benchmarks: [
			benchmark(unit, 'cold-start'),
			benchmark('reports.function.other', 'cold-start'),
			benchmark(unit, 'warm-run')
		]
	} as Parameters<typeof unitTimings>[0];
	const timings = unitTimings(index, unit);
	expect(timings.map((item) => item.workload)).toEqual(['cold-start', 'warm-run']);
	recordExampleCases(
		{
			unitId: unit,
			symbol: 'unitTimings',
			state: 'keeps-matching-benchmark-conditions-separate',
			evidence: 'examples-cases',
			file: 'keeps-matching-benchmark-conditions-separate.json'
		},
		[
			{
				name: 'returns only matching benchmark records in source order',
				input: { unit, benchmarks: index.benchmarks },
				output: timings
			}
		]
	);
});

test('Formats signed deltas and exposes ordered metric keys', () => {
	const values = [undefined, 0, 8, -3].map((delta) => ({ delta, formatted: signed(delta) }));
	const metrics: readonly GrowthMetric[] = growthMetrics;
	expect(values.map(({ formatted }) => formatted)).toEqual(['', '', '+8', '-3']);
	recordExampleCases(
		{
			unitId: unit,
			symbol: 'signed',
			state: 'formats-signed-deltas-and-exposes-ordered-metric-keys',
			evidence: 'examples-cases',
			file: 'formats-signed-deltas-and-exposes-ordered-metric-keys.json'
		},
		[
			{
				name: 'formats unavailable, zero, positive and negative changes',
				input: [undefined, 0, 8, -3],
				output: values
			},
			{ name: 'provides ordered growth metric names', input: null, output: [...metrics] }
		]
	);
});
