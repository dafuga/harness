import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	historySeries,
	unitGrowth
} from '../../src/cli/program/history-index-service/historySeries';
import type { BudgetReview } from '../../src/utils/verification-evidence/budgetReviews';
import type {
	Measurement,
	VerificationRecord
} from '../../src/core/verification-evidence/verificationTypes';

const unit = 'function.history-series';
const first = 'a'.repeat(40);
const second = 'b'.repeat(40);
const profile = 'linux-x64-ci';
const sizeMethod = 'Byte count of the unit source.';
const timingMethod = 'Median of timed rounds.';
const comparison = {
	request: 'c'.repeat(64),
	boundary: 'public-invocation' as const,
	protocol: 'harness-rounds/1',
	sampling: { warmup: 3, rounds: 5, iterations: 20 }
};
const review: BudgetReview = {
	type: 'baseline',
	commit: first,
	record: 'r-1',
	reviewer: 'reviewer-1',
	reason: 'Initial frozen limits.',
	at: '2026-11-18T09:00:00.000Z',
	after: { 'source-bytes': 100 }
};

const measure = (
	fields: Partial<Measurement> & Pick<Measurement, 'unit' | 'metric' | 'value'>
) => ({
	unitOfMeasure: 'bytes',
	method: sizeMethod,
	workload: null,
	profile: null,
	testedRevision: first,
	artifacts: [],
	...fields
});

const size = (
	unitId: string,
	metric: string,
	value: number | null,
	extra: Partial<Measurement> = {}
) => measure({ unit: unitId, metric, value, ...extra });

const timing = (unitId: string, value: number | null, extra: Partial<Measurement> = {}) =>
	measure({
		unit: unitId,
		metric: 'latency-warm-ms',
		value,
		unitOfMeasure: 'ms',
		method: timingMethod,
		workload: 'render 1k',
		profile,
		...extra
	});

const recordOf = (id: string, measurements: Measurement[]) =>
	({ id, measurements }) as unknown as VerificationRecord;

const recorded = (symbol: string, state: string) => ({
	unitId: unit,
	symbol,
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

test('Orders unit growth points and keeps the first record of a commit', () => {
	const records = [
		recordOf('r-beta', [size('function.beta', 'source-bytes', 200, { testedRevision: first })]),
		recordOf('r-alpha', [size('function.alpha', 'source-bytes', 100, { testedRevision: first })]),
		recordOf('r-alpha-next', [
			size('function.alpha', 'source-bytes', 120, { testedRevision: second }),
			size('function.alpha', 'artifact-bytes', 4096, { target: 'module', testedRevision: second })
		]),
		recordOf('r-alpha-repeat', [size('function.alpha', 'complexity', 7, { testedRevision: first })])
	];
	const output = unitGrowth(records);
	expect(output).toEqual([
		{
			id: 'function.alpha',
			growth: [
				{ commit: first, record: 'r-alpha', 'source-bytes': 100, complexity: 7 },
				{ commit: second, record: 'r-alpha-next', 'source-bytes': 120, emitted: { module: 4096 } }
			]
		},
		{
			id: 'function.beta',
			growth: [{ commit: first, record: 'r-beta', 'source-bytes': 200 }]
		}
	]);
	recordExampleCases(recorded('unitGrowth', 'orders-unit-growth'), [
		{ name: 'points follow supplied order per unit', input: { records }, output }
	]);
});

test('Keeps missing growth metrics as notes and attaches only supplied reviews', () => {
	const records = [
		recordOf('r-1', [
			size('function.alpha', 'source-bytes', null, { unavailable: 'Source was not read.' }),
			size('function.alpha', 'dependencies', 3, { partial: 'one manifest was not read' }),
			size('function.alpha', 'artifact-bytes', null, {
				target: 'wasm',
				unavailable: 'The wasm build was not run.'
			}),
			size('function.alpha', 'source-bytes', 55, { profile, workload: 'render 1k' }),
			size('function.alpha', 'artifact-bytes', 900, {
				target: 'module',
				profile,
				workload: 'render 1k'
			}),
			size('function.beta', 'source-bytes', 50)
		])
	];
	const reviews = new Map([['function.alpha', [review]]]);
	const output = unitGrowth(records, reviews);
	expect(output).toEqual([
		{
			id: 'function.alpha',
			growth: [
				{
					commit: first,
					record: 'r-1',
					dependencies: 3,
					notes: {
						'source-bytes': 'Source was not read.',
						dependencies: 'one manifest was not read',
						'artifact-bytes:wasm': 'The wasm build was not run.'
					}
				}
			],
			reviews: [review]
		},
		{
			id: 'function.beta',
			growth: [{ commit: first, record: 'r-1', 'source-bytes': 50 }]
		}
	]);
	recordExampleCases(recorded('unitGrowth', 'notes-missing-growth-metrics'), [
		{ name: 'missing metrics stay notes', input: { records, reviews }, output }
	]);
});

test('Groups compatible timings into one benchmark line', () => {
	const records = [
		recordOf('r-1', [timing('function.alpha', 12, { testedRevision: first })]),
		recordOf('r-2', [timing('function.alpha', 10, { testedRevision: second })])
	];
	const output = historySeries(records);
	expect(output).toEqual([
		{
			unit: 'function.alpha',
			workload: 'render 1k',
			metric: 'latency-warm-ms',
			target: null,
			incompatible: false,
			series: [
				{
					profile,
					unitOfMeasure: 'ms',
					method: timingMethod,
					comparison: null,
					points: [
						{ commit: first, record: 'r-1', value: 12 },
						{ commit: second, record: 'r-2', value: 10 }
					]
				}
			]
		}
	]);
	recordExampleCases(recorded('historySeries', 'groups-compatible-timings'), [
		{ name: 'identical definitions form one line', input: { records }, output }
	]);
});

test('Separates incomparable timings and omits unmeasured ones', () => {
	const records = [
		recordOf('r-1', [timing('function.alpha', 12, { testedRevision: first })]),
		recordOf('r-2', [
			timing('function.alpha', 10, { testedRevision: second }),
			timing('function.alpha', 9, { testedRevision: second, profile: 'another-runner' }),
			timing('function.alpha', 2000, { testedRevision: second, unitOfMeasure: 'us' }),
			timing('function.alpha', 8, { testedRevision: second, method: 'Single run.' }),
			timing('function.alpha', 11, { testedRevision: second, comparison }),
			timing('function.alpha', null, { testedRevision: second, unavailable: 'Not measured.' }),
			timing('function.alpha', 3, { testedRevision: second, workload: null }),
			timing('function.alpha', 4, { testedRevision: second, profile: null })
		])
	];
	const output = historySeries(records);
	expect(output).toHaveLength(1);
	expect(output[0]).toMatchObject({ incompatible: true });
	expect(output[0]?.series.map((line) => line.points.map((point) => point.value))).toEqual([
		[9],
		[12, 10],
		[2000],
		[8],
		[11]
	]);
	recordExampleCases(recorded('historySeries', 'separates-incomparable-timings'), [
		{
			name: 'profile, unit of measure, method and comparison split lines',
			input: { records },
			output
		}
	]);
});
