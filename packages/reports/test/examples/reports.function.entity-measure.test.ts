import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import * as measures from '../../src/utils/explorer-ui/entityMeasure';
import { entityMeasure } from '../../src/components/explorer-ui/entity-sections/entityMeasure';
import type * as harness from '../../src/models/explorer-ui/Harness.types';
import { record as fixtureRecord } from '../entityFixture';
import { commits } from '../entityUnits';
import type {
	Cases,
	Patch,
	Budget,
	Measurement
} from './reports.function.entity-measure.test.types';

const subject = 'app.function.filter-orders';
const base = { unitId: 'reports.function.entity-measure', evidence: 'examples-cases' };
const save = (symbol: string, state: string, cases: Cases) =>
	recordExampleCases({ ...base, symbol, state, file: `${state}.json` }, cases);

const unitOf = (patch: Patch = {}, performance: Budget[] = []): harness.HarnessUnit => ({
	id: subject,
	kind: 'function',
	status: 'active',
	title: 'filterOrders',
	responsibility: 'Filters orders.',
	dependencies: [],
	scenarios: [],
	owns: { source: [], symbols: ['filterOrders', 'matchOrder'] },
	contract: { inputs: [], outputs: [], errors: [] },
	runtime: { kind: 'module', targets: [] },
	budgets: { size: 'frozen', complexity: 'frozen', performance },
	version: 'fixture',
	...patch
});
const measure = (patch: Partial<Measurement>): Measurement => ({
	unit: subject,
	metric: 'complexity',
	unitOfMeasure: 'points',
	value: 0,
	workload: null,
	profile: null,
	...patch
});
const withRecord = (measurements: Measurement[]): harness.HarnessRecord => ({
	...fixtureRecord(commits.middle),
	measurements,
	budgets: { findings: [] }
});
const wasmUnit = () =>
	unitOf({ runtime: { kind: 'module', targets: [{ kind: 'wasm', entry: 'a.wasm' }] } });

test('A byte count reads as B, KB or MB by its magnitude and keeps its sign', () => {
	const counts = [800, -2400, 1_000, 999_999, 1_000_000, -3_400_000, 0];
	const texts = ['800 B', '-2.4 KB', '1 KB', '1000 KB', '1 MB', '-3.4 MB', '0 B'];
	const outputs = counts.map((count) => measures.byteSize(count));
	expect(outputs).toEqual(texts);
	const cases = counts.map((count, index) => ({
		name: `count ${count}`,
		input: { count },
		output: outputs[index]
	}));
	save('byteSize', 'byte-size-scales-and-keeps-sign', cases);
});

test('A unit with nothing recorded shows Not measured for each size and timing, never zero', () => {
	const unit = unitOf({}, [{ workload: 'thousand-orders', metric: 'p95-ms', tolerance: 0.05 }]);
	const output = entityMeasure(unit, null);
	expect(output.size.map((row) => row.label)).toEqual([
		'Source size',
		'Emitted size',
		'Complexity'
	]);
	expect(output.size.map(({ value }) => value)).toEqual(Array(3).fill(measures.notMeasured));
	expect(output.size[1]).toMatchObject({ target: 'none' });
	expect(output.performance).toEqual([
		expect.objectContaining({
			profile: '',
			value: measures.notMeasured,
			tolerance: '5%',
			over: false
		})
	]);
	save('entityMeasure', 'absent-measurements-read-not-measured', [
		{ name: 'no measurements, timing budget, null record', input: { record: null }, output }
	]);
});

test('Observations of another unit or an unowned callable never reach this unit; an owned callable does', () => {
	const observed = [
		measure({ unit: 'app.function.export-orders', value: 99 }),
		measure({ callable: 'hiddenHelper', value: 50 }),
		measure({ callable: 'matchOrder', value: 7 }),
		measure({ callable: 'matchOrder', metric: 'source-bytes', unitOfMeasure: 'bytes', value: 1500 })
	];
	const output = entityMeasure(unitOf(), null, observed);
	expect(output.size.map(({ rawValue }) => rawValue)).toEqual([1500, null, 7]);
	expect(output.size[0].value).toBe('1.5 KB');
	save('entityMeasure', 'scoped-observations-owned-callable-only', [
		{ name: 'other unit and unowned callable dropped', input: { observations: 4 }, output }
	]);
});

test('A unit source measurement outranks the record and an observation of the same metric', () => {
	const unit = unitOf({
		sourceMeasurements: [measure({ metric: 'source-bytes', unitOfMeasure: 'bytes', value: 3456 })]
	});
	const selected = withRecord([
		measure({ metric: 'source-bytes', unitOfMeasure: 'bytes', value: 2400 }),
		measure({ metric: 'complexity', value: 3 })
	]);
	const observed = [measure({ metric: 'source-bytes', unitOfMeasure: 'bytes', value: 9000 })];
	const output = entityMeasure(unit, selected, observed);
	expect(output.size[0]).toMatchObject({ value: '3.5 KB', rawValue: 3456 });
	expect(output.size[2].value).toBe('3');
	save('entityMeasure', 'source-outranks-record-and-observation', [
		{ name: 'source 3456, record 2400, observation 9000', input: { record: 'passed' }, output }
	]);
});

test('Timings stay one row per profile and target; unbudgeted timings need workload and profile', () => {
	const timed = (patch: Partial<Measurement>) =>
		measure({ metric: 'p95-ms', unitOfMeasure: 'ms', workload: 'thousand-orders', ...patch });
	const latency = { metric: 'latency-warm-ms', unitOfMeasure: 'ms', workload: 'orders-export' };
	const unit = unitOf({}, [
		{ workload: 'thousand-orders', metric: 'p95-ms', tolerance: 0.05, target: 'process' }
	]);
	const observed = [
		timed({ profile: 'bun-reference', target: 'process', value: 0.12 }),
		timed({ profile: 'ci-linux', target: 'process', value: 0.31 }),
		timed({ profile: 'bun-reference', target: 'wasm', value: 0.5 }),
		timed({ profile: null, target: 'process', value: 0.9 }),
		measure({ ...latency, profile: 'bun-reference', value: 1.5 }),
		measure({ ...latency, profile: null, value: 2.5 })
	];
	const rows = entityMeasure(unit, null, observed).performance;
	expect(rows.map(({ profile, value }) => [profile, value])).toEqual([
		['bun-reference', '0.12 ms'],
		['ci-linux', '0.31 ms'],
		['', '0.9 ms'],
		['bun-reference', '1.5 ms']
	]);
	expect(rows[3]).toMatchObject({
		workload: 'orders export',
		metric: 'Warm latency per call',
		tolerance: '—'
	});
	save('entityMeasure', 'timings-split-by-profile-and-target', [
		{
			name: 'two profiles, wasm excluded, unbudgeted timing',
			input: { observations: 6 },
			output: rows
		}
	]);
});

test('A tolerance is marked over only when it is above the five percent policy', () => {
	expect(measures.tolerancePolicy).toBe(0.05);
	const tolerances = [0.04, 0.05, 0.051, 0.2];
	const perf = { workload: 'thousand-orders', metric: 'p95-ms' };
	const budgets = tolerances.map((tolerance) => ({ ...perf, tolerance }));
	const rows = entityMeasure(unitOf({}, budgets), null).performance;
	expect(rows.map(({ tolerance, over }) => [tolerance, over])).toEqual([
		['4%', false],
		['5%', false],
		['5%', true],
		['20%', true]
	]);
	save(
		'entityMeasure',
		'tolerance-marked-only-above-policy',
		tolerances.map((tolerance, index) => ({
			name: `tolerance ${tolerance}`,
			input: { tolerance },
			output: rows[index]
		}))
	);
});

test('A failed or invalid record still supplies its measurements; its status is not judged here', () => {
	const rejected = {
		...withRecord([
			measure({ metric: 'complexity', value: 11 }),
			measure({ metric: 'artifact-bytes', unitOfMeasure: 'bytes', target: 'wasm', value: 18000 })
		]),
		status: 'failed' as const,
		valid: false,
		problems: ['stale source']
	};
	const output = entityMeasure(wasmUnit(), rejected);
	expect(output.size[2].value).toBe('11');
	expect(output.size).toContainEqual(
		expect.objectContaining({
			label: 'Emitted size · Wasm',
			target: 'wasm',
			value: '18 KB',
			rawValue: 18000
		})
	);
	save('entityMeasure', 'invalid-record-measurements-still-used', [
		{ name: 'failed and invalid record kept', input: { record: 'invalid' }, output }
	]);
});

test('A null record on a unit with a Wasm target shows its Wasm size Not measured and keeps an observed Wasm size', () => {
	const unavailable = entityMeasure(wasmUnit(), null);
	expect(unavailable.size[1]).toMatchObject({
		label: 'Emitted size · Wasm',
		target: 'wasm',
		value: measures.notMeasured,
		rawValue: null,
		unitOfMeasure: 'bytes'
	});
	const output = entityMeasure(wasmUnit(), null, [
		measure({ metric: 'artifact-bytes', unitOfMeasure: 'bytes', target: 'wasm', value: 18000 })
	]);
	expect(output.size[1]).toMatchObject({
		label: 'Emitted size · Wasm',
		target: 'wasm',
		value: '18 KB',
		rawValue: 18000,
		unitOfMeasure: 'bytes'
	});
	save('entityMeasure', 'null-record-wasm-unit-not-measured', [
		{ name: 'null record, Not measured', input: { record: null }, output: unavailable },
		{ name: 'null record, observed 18000 bytes', input: { observations: 1 }, output }
	]);
});
