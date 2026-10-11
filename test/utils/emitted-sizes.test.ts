import { expect, test } from 'vitest';
import type { BudgetEvent } from '../../src/core/budgetTypes';
import type { ComponentManifest } from '../../src/core/unitTypes';
import { BudgetService } from '../../src/services/BudgetService';
import { budgetFindings, type BudgetBaseline } from '../../src/utils/budgetFindings';
import { emittedKey, emittedSizes } from '../../src/utils/emittedSizes';
import { unitMeasurements, type BuiltArtifacts } from '../../src/utils/unitMeasurements';

const commit = 'a'.repeat(40);
const sha = (letter: string) => letter.repeat(64);
const kernel = (targets: Array<{ kind: string; entry: string }>) =>
	({
		id: 'kernel.impact',
		owns: { source: [] },
		dependencies: [],
		runtime: { kind: 'process', targets },
		budgets: { performance: [] }
	}) as unknown as ComponentManifest;
const both = kernel([
	{ kind: 'process', entry: 'target/kernel' },
	{ kind: 'wasm', entry: 'target/kernel.wasm' }
]);
// The sizes of the first real record: a process binary and a much smaller Wasm module.
const built: BuiltArtifacts = {
	'target/kernel': { bytes: 402048, sha256: sha('1') },
	'target/kernel.wasm': { bytes: 143132, sha256: sha('2') }
};
const emitted = (unit: ComponentManifest, artifacts: BuiltArtifacts) =>
	unitMeasurements(unit, new Map(), commit, artifacts).filter(
		(row) => row.metric === 'artifact-bytes'
	);
const reviewed: BudgetBaseline = {
	metrics: { [emittedKey('process')]: 402048, [emittedKey('wasm')]: 143132 },
	performance: []
};
const judge = (
	artifacts: BuiltArtifacts,
	baseline: BudgetBaseline | undefined,
	unit = both,
	checkSize = false
) =>
	budgetFindings({
		unit: unit.id,
		profile: 'machine',
		defaultTarget: 'process',
		budgets: [],
		measurements: unitMeasurements(unit, new Map(), commit, artifacts),
		baseline,
		checkSize
	});
const grown = (process: number, wasm: number): BuiltArtifacts => ({
	'target/kernel': { bytes: process, sha256: sha('3') },
	'target/kernel.wasm': { bytes: wasm, sha256: sha('4') }
});

test('each execution target has one size, with the hash of every artifact it is made of', () => {
	expect(emitted(both, built)).toEqual([
		expect.objectContaining({
			target: 'process',
			value: 402048,
			artifacts: [{ path: 'target/kernel', bytes: 402048, sha256: sha('1') }]
		}),
		expect.objectContaining({
			target: 'wasm',
			value: 143132,
			artifacts: [{ path: 'target/kernel.wasm', bytes: 143132, sha256: sha('2') }]
		})
	]);
	// Two artifacts of one target are one size; a target is never added to another.
	const split = kernel([
		{ kind: 'wasm', entry: 'target/a.wasm' },
		{ kind: 'wasm', entry: 'target/b.wasm' },
		{ kind: 'wasm', entry: 'target/a.wasm' },
		{ kind: 'process', entry: 'target/kernel' }
	]);
	const parts = { ...built, 'target/a.wasm': { bytes: 10, sha256: sha('a') } };
	const whole = { ...parts, 'target/b.wasm': { bytes: 5, sha256: sha('b') } };
	expect(emitted(split, whole).map((row) => [row.target, row.value, row.artifacts.length])).toEqual(
		[
			['wasm', 15, 2],
			['process', 402048, 1]
		]
	);
	// One part that was not built leaves the size unknown; it is not the sum of the rest.
	const [partial] = emitted(split, parts);
	expect(partial).toMatchObject({
		value: null,
		unavailable: 'target/b.wasm was not built in the verified snapshot.',
		artifacts: [{ path: 'target/a.wasm', bytes: 10, sha256: sha('a') }]
	});
	// A module emits nothing: one statement of that, no target and no zero.
	expect(emitted(kernel([]), built)).toEqual([
		expect.objectContaining({
			value: null,
			unavailable: 'A module unit emits no separate artifact.'
		})
	]);
});

test('only sizes measured from the build of the snapshot are frozen, not what a benchmark reports', () => {
	const reported = { metric: 'artifact-bytes', workload: null, profile: 'machine' };
	const rows = [
		...unitMeasurements(both, new Map(), commit, built),
		{ ...reported, target: 'wasm' as const, value: 1 },
		{ ...reported, target: 'module' as const, value: null, unavailable: 'no separate artifact' }
	];
	expect(emittedSizes(rows).map((row) => [row.target, row.value])).toEqual([
		['process', 402048],
		['wasm', 143132]
	]);
	expect(emittedSizes(unitMeasurements(kernel([]), new Map(), commit))).toEqual([]);
});

test('a target is judged against its own limit, whether or not the source of the unit changed', () => {
	expect(judge(built, reviewed).map((item) => [item.target, item.status])).toEqual([
		['process', 'passed'],
		['wasm', 'passed']
	]);
	// The Wasm module grows by what the process binary lost: the sum is what it was.
	const moved = judge(grown(402048 - 1000, 143132 + 1000), reviewed);
	const process = { target: 'process', status: 'passed', baseline: 402048, measured: 401048 };
	const wasm = { target: 'wasm', status: 'exceeded', baseline: 143132, measured: 144132 };
	expect(moved).toEqual(
		[process, wasm].map((item) => ({ unit: both.id, metric: 'artifact-bytes', ...item }))
	);
	// With the source judged too, the three source limits come first and change nothing here.
	const all = judge(built, reviewed, both, true);
	expect(all.map((item) => item.metric)).toEqual([
		'source-bytes',
		'complexity',
		'dependencies',
		'artifact-bytes',
		'artifact-bytes'
	]);
	expect(judge({}, reviewed, kernel([]))).toEqual([]);
});

test('an output that is gone, was never measurable, becomes measurable or has no limit yet is told apart', () => {
	const gone = judge({ 'target/kernel': built['target/kernel'] }, reviewed)[1];
	expect(gone).toMatchObject({
		target: 'wasm',
		status: 'missing-measurement',
		baseline: 143132,
		measured: null,
		detail: 'target/kernel.wasm was not built in the verified snapshot.'
	});
	const never: BudgetBaseline = {
		metrics: { [emittedKey('process')]: 402048 },
		unmeasured: { [emittedKey('wasm')]: 'No Wasm toolchain was installed.' },
		performance: []
	};
	expect(judge({ 'target/kernel': built['target/kernel'] }, never)[1].status).toBe('unavailable');
	expect(judge(built, never)[1]).toMatchObject({
		status: 'missing-baseline',
		detail: 'measurable-now'
	});
	// A baseline from before the unit emitted anything, or before emitted sizes were frozen.
	const earlier: BudgetBaseline = { metrics: { 'source-bytes': 10 }, performance: [] };
	expect(judge(built, earlier).map((item) => [item.status, item.detail])).toEqual([
		['missing-baseline', 'no-limit-for-output'],
		['missing-baseline', 'no-limit-for-output']
	]);
	expect(judge(built, undefined).map((item) => [item.status, item.detail])).toEqual([
		['missing-baseline', undefined],
		['missing-baseline', undefined]
	]);
});

test('the ledger keeps a limit for each target, and every failure names the target it is about', () => {
	const signed = {
		unit: both.id,
		record: { id: 'r', commit, tree: commit },
		reviewer: 'Reviewer',
		reason: 'Reviewed',
		at: '2026-10-11T00:00:00.000Z',
		performance: []
	};
	const ledger: BudgetEvent[] = [
		{ type: 'baseline', ...signed, metrics: { ...reviewed.metrics } },
		{
			type: 'approval',
			...signed,
			before: { [emittedKey('wasm')]: 143132 },
			after: { [emittedKey('wasm')]: 150000 }
		}
	];
	const service = new BudgetService();
	const baselines = service.baselines(ledger, [both]);
	expect(baselines.get(both.id)?.metrics).toEqual({
		[emittedKey('process')]: 402048,
		[emittedKey('wasm')]: 150000
	});
	const report = (artifacts: BuiltArtifacts, limits = baselines) =>
		service.evaluate([{ manifest: both, checkSize: false }], {
			measurements: unitMeasurements(both, new Map(), commit, artifacts),
			baselines: limits,
			profile: 'machine'
		}).failures;
	expect(report(grown(402048, 150000))).toEqual([]);
	expect(report(grown(402049, 150001))).toEqual([
		'kernel.impact: artifact-bytes of the process target grew from 402048 to 402049 without a recorded approval',
		'kernel.impact: artifact-bytes of the wasm target grew from 150000 to 150001 without a recorded approval'
	]);
	const earlier = new Map([[both.id, { metrics: { 'source-bytes': 10 }, performance: [] }]]);
	expect(report({ 'target/kernel': built['target/kernel'] }, earlier)).toEqual([
		'kernel.impact: artifact-bytes of the process target is 402048 and has no frozen limit: the baseline of the unit does not cover this output; a reviewer must approve a limit',
		'kernel.impact: artifact-bytes of the wasm target was not measured: target/kernel.wasm was not built in the verified snapshot.'
	]);
});
