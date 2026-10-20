import { afterAll, expect, test } from 'vitest';
import {
	evidenceRequested,
	recordCapture
} from '../../../../src/utils/record-capture/recordCapture';
import { byteSize, notMeasured } from '../../src/utils/entityMeasure';
import { entityMeasure } from '../../src/components/harness/entity-sections/entityMeasure';
import { record } from '../entityFixture';
import { commits, ids, units } from '../entityUnits';

const find = (id: string) => units.find((unit) => unit.id === id)!;
const taken = record(commits.middle);
const value = (rows: Array<{ label: string; value: string }>, label: string) =>
	rows.find((item) => item.label === label)?.value;

afterAll(() => {
	if (!evidenceRequested()) return;
	const samples: number[] = [];
	for (let round = 0; round < 5; round++) {
		const start = performance.now();
		for (let iteration = 0; iteration < 100; iteration++)
			for (const unit of units) entityMeasure(unit, taken);
		samples.push((performance.now() - start) / (100 * units.length));
	}
	const context = {
		unit: 'reports.function.entity-measure',
		callable: 'entityMeasure',
		workload: 'orders-entity-kinds',
		target: 'module',
		samples: 500 * units.length
	};
	const measurements = [
		{
			...context,
			metric: 'latency-warm-ms',
			unitOfMeasure: 'ms',
			value: samples.sort((a, b) => a - b)[2],
			method:
				'Median per call from five batches of 100 passes over the standard orders entities and their recorded measurements.'
		},
		{
			...context,
			metric: 'process-peak-rss-bytes',
			unitOfMeasure: 'bytes',
			value: process.resourceUsage().maxRSS * 1024,
			method:
				'Peak RSS of the whole benchmark process including Vitest; not memory attributable to this formatter.'
		}
	];
	recordCapture(
		{
			evidence: 'entity-measure-benchmark',
			state: 'entity-kinds',
			kind: 'benchmark',
			file: 'entity-measure-benchmark.json',
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
});

test('a size is read in bytes, kilobytes or megabytes, and never rounded to nothing', () => {
	expect(byteSize(800)).toBe('800 B');
	expect(byteSize(2400)).toBe('2.4 KB');
	expect(byteSize(18000)).toBe('18 KB');
	expect(byteSize(3_400_000)).toBe('3.4 MB');
	expect(byteSize(0)).toBe('0 B');
});

test('a measured size is shown and one nothing measured reads Not measured, never zero', () => {
	const list = entityMeasure(find(ids.list), taken);
	expect(value(list.size, 'Source size')).toBe('2.4 KB');
	expect(value(list.size, 'Complexity')).toBe('3');
	expect(value(list.size, 'Emitted size')).toBe(notMeasured);
	expect(list.size).toContainEqual(
		expect.objectContaining({ label: 'Emitted size', target: 'none' })
	);
	const observed = {
		...find(ids.list),
		sourceMeasurements: [
			{
				unit: ids.list,
				metric: 'source-bytes',
				unitOfMeasure: 'bytes',
				get value() {
					return 3456;
				},
				workload: null,
				profile: null
			},
			{
				unit: ids.list,
				metric: 'complexity',
				unitOfMeasure: 'points',
				value: 17,
				workload: null,
				profile: null
			}
		]
	};
	const source = observed.sourceMeasurements;
	let iterations = 0;
	source[Symbol.iterator] = function* () {
		iterations++;
		yield* Array.prototype.values.call(source);
	};
	Object.defineProperty(source, 'constructor', {
		get() {
			throw new Error('Input array species must not be used.');
		}
	});
	const fresh = entityMeasure(observed, taken);
	expect(iterations, 'the admitted source iterator is consumed once').toBe(1);
	expect(value(fresh.size, 'Source size'), 'selected source outranks an older record').toBe(
		'3.5 KB'
	);
	expect(value(fresh.size, 'Complexity')).toBe('17');
	const card = entityMeasure(find(ids.card), taken);
	expect(value(card.size, 'Source size')).toBe(notMeasured);
	expect(JSON.stringify(card)).not.toMatch(/"0( B)?"/);
});

test('each execution target has its own emitted size, with the reason one could not be built', () => {
	const store = entityMeasure(find(ids.store), taken);
	expect(value(store.size, 'Emitted size · Wasm')).toBe('18 KB');
	const native = store.size.find((item) => item.label === 'Emitted size · process (native)');
	expect(native?.value).toBe(notMeasured);
	expect(native?.note).toContain('no toolchain');
	expect(native).toMatchObject({ target: 'process' });
	expect(store.size).toContainEqual(
		expect.objectContaining({ label: 'Emitted size · Wasm', target: 'wasm', value: '18 KB' })
	);
});

test('a timing names its workload and profile and its tolerance as a percentage', () => {
	const [timing] = entityMeasure(find(ids.filter), taken).performance;
	expect(timing).toMatchObject({
		workload: 'thousand orders',
		metric: 'p95 ms',
		profile: 'bun-reference',
		value: '0.12 ms',
		tolerance: '5%',
		over: false
	});
});

test('timings of two profiles stay two rows, and a declared budget nothing measured is not measured', () => {
	const second = {
		...taken,
		measurements: [
			...taken.measurements,
			{
				unit: ids.filter,
				metric: 'p95-ms',
				unitOfMeasure: 'ms',
				value: 0.31,
				workload: 'thousand-orders',
				profile: 'ci-linux'
			}
		]
	};
	const rows = entityMeasure(find(ids.filter), second).performance;
	expect(rows.map((item) => [item.profile, item.value])).toEqual([
		['bun-reference', '0.12 ms'],
		['ci-linux', '0.31 ms']
	]);
	const [none] = entityMeasure(find(ids.filter), null).performance;
	expect(none.value).toBe(notMeasured);
	expect(none.profile).toBe('');
});

test('a tolerance above the five percent policy is marked, not clamped', () => {
	const loose = {
		...find(ids.filter),
		budgets: {
			...find(ids.filter).budgets,
			performance: [{ workload: 'thousand-orders', metric: 'p95-ms', tolerance: 0.2 }]
		}
	};
	const [timing] = entityMeasure(loose, taken).performance;
	expect(timing.tolerance).toBe('20%');
	expect(timing.over).toBe(true);
});

test('why a figure is unavailable is told without the file a recorded note names', () => {
	const noted = record(commits.middle);
	const said = 'the build of crates/kernel/src/lib.rs produced no output';
	noted.measurements = noted.measurements.map((item) =>
		item.unit === ids.store && item.value === null ? { ...item, unavailable: said } : item
	);
	noted.measurements.push({
		unit: ids.store,
		metric: 'source-bytes',
		unitOfMeasure: 'bytes',
		value: null,
		workload: null,
		profile: null,
		unavailable: 'unreadable in src/services/OrderStore.ts'
	});
	const store = entityMeasure(find(ids.store), noted);
	const notes = store.size.map((row) => row.note ?? '').join(' | ');
	expect(notes).toContain('the build of a file produced no output');
	expect(notes).toContain('unreadable');
	// Where a file is stays under Details, Source and in the stored record.
	expect(notes).not.toMatch(/crates\/|src\/|\.rs\b|\.ts\b/);
});

test('observed performance is visible without a budget and stays scoped to its callable', () => {
	const helper = {
		...find(ids.filter),
		budgets: { size: 'none', complexity: 'none', performance: [] }
	};
	const rows = entityMeasure(helper, taken).performance;
	expect(rows, 'measurements do not require a performance budget').toEqual(
		expect.arrayContaining([
			expect.objectContaining({ profile: 'bun-reference', value: '0.12 ms', tolerance: '—' })
		])
	);
});
