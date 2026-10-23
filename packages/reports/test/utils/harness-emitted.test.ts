import { expect, test } from 'vitest';
import type { HarnessIndex, HarnessRecord, HarnessUnit } from '../../src/models/Harness.types';
import { emittedChange } from '../../src/components/explorer-ui/harness-compare/harnessEmitted';
import { harnessEmitted } from '../../src/utils/harnessEmitted';
import { harnessEmittedGrowth } from '../../src/components/explorer-ui/harness-growth/harnessEmittedGrowth';

const kernel = (emitted?: HarnessUnit['emitted'], kinds = ['process', 'wasm']) =>
	({
		id: 'kernel.impact',
		runtime: { kind: 'process', targets: kinds.map((kind) => ({ kind, entry: `target/${kind}` })) },
		...(emitted ? { emitted } : {})
	}) as unknown as HarnessUnit;
const size = (target: string | undefined, value: number | null, extra: object = {}) => ({
	unit: 'kernel.impact',
	metric: 'artifact-bytes',
	unitOfMeasure: 'bytes',
	value,
	workload: null,
	profile: null,
	...(target ? { target } : {}),
	...extra
});
const record = (measurements: object[], findings: object[] = []) =>
	({ measurements, budgets: { findings } }) as unknown as HarnessRecord;
// The sizes of the first real record, and what a benchmark reported about itself beside them.
const real = record([
	size('process', 402048),
	size('wasm', 143132),
	size('process', 1, { profile: 'machine' }),
	size('module', null, { profile: 'machine', unavailable: 'no separate artifact' })
]);

test('each target reads with its own bytes and its own limit, and a benchmark report is not one', () => {
	const limits = { limits: { process: 402048, wasm: 150000 } };
	expect(harnessEmitted(kernel(limits), real)).toEqual([
		{
			target: 'process',
			label: 'process (native)',
			value: '402048 bytes',
			limit: 'frozen at 402048 bytes'
		},
		{ target: 'wasm', label: 'Wasm', value: '143132 bytes', limit: 'frozen at 150000 bytes' }
	]);
	// No ledger yet, as in the first real record: both sizes are there, and no limit is.
	expect(harnessEmitted(kernel(), real).map((line) => line.limit)).toEqual([
		'no limit is recorded at this revision',
		'no limit is recorded at this revision'
	]);
	expect(harnessEmitted(kernel(limits), null).map((line) => line.value)).toEqual([
		'not measured at this revision',
		'not measured at this revision'
	]);
});

test('an output that grew, is gone, was never buildable or does not exist is said as that, never as zero', () => {
	const finding = (
		target: string,
		status: string,
		baseline: number | null,
		measured: number | null
	) => ({
		unit: 'kernel.impact',
		metric: 'artifact-bytes',
		target,
		status,
		baseline,
		measured
	});
	const gone = record(
		[
			size('process', 7),
			size('wasm', null, { unavailable: 'target/wasm was not built in the verified snapshot.' })
		],
		[finding('process', 'exceeded', 3, 7), finding('wasm', 'missing-measurement', 1, null)]
	);
	const [process, wasm] = harnessEmitted(kernel({ limits: { process: 3, wasm: 1 } }), gone);
	expect(process).toMatchObject({
		value: '7 bytes',
		limit: 'frozen at 3 bytes',
		note: 'Grew from 3 to 7 bytes without a recorded approval.'
	});
	expect(wasm).toMatchObject({
		value: 'unavailable: target/wasm was not built in the verified snapshot.',
		limit: 'frozen at 1 byte',
		note: 'Was 1 byte at its baseline and can no longer be measured.'
	});
	const never = kernel({ limits: { process: 3 }, unmeasured: { wasm: 'No Wasm toolchain.' } });
	expect(harnessEmitted(never, gone)[1].limit).toBe('not frozen: reviewed as not buildable');
	const module = record([
		size(undefined, null, { unavailable: 'A module unit emits no separate artifact.' })
	]);
	expect(harnessEmitted(kernel(undefined, ['module']), module)).toEqual([
		{
			target: 'none',
			label: '',
			value: 'none: A module unit emits no separate artifact.',
			limit: 'no limit applies'
		}
	]);
});

test('a comparison has the size of each target on both sides, and nothing where a side has none', () => {
	const sides = [
		{ units: [kernel()], record: record([size('process', 3), size('wasm', 5)]) },
		{ units: [kernel()], record: record([size('process', 7), size('wasm', null)]) }
	];
	expect(emittedChange('kernel.impact', sides)).toEqual([
		{ target: 'process', label: 'process (native)', before: 3, after: 7 },
		{ target: 'wasm', label: 'Wasm', before: 5, after: null }
	]);
	expect(
		emittedChange('kernel.impact', [{ units: [kernel(undefined, ['module'])], record: null }])
	).toEqual([]);
});

const commits = ['e', 'd', 'c', 'b', 'a'].map((letter) => letter.repeat(40));
const [later, vanished, approved, swapped, first] = commits;
const review = (type: string, commit: string, before: object | undefined, after: object) => ({
	type,
	commit,
	record: 'r',
	reviewer: 'Reviewer One',
	reason: 'Reviewed',
	at: `2026-10-11T00:00:0${5 - commits.indexOf(commit)}Z`,
	...(before ? { before } : {}),
	after
});
const keyed = (process: number, wasm: number) => ({
	'artifact-bytes:process': process,
	'artifact-bytes:wasm': wasm
});
const missing = { notes: { 'artifact-bytes:wasm': 'It was not built.' } };
const index = {
	revisions: commits.map((commit) => ({ commit, subject: `commit ${commit[0]}` })),
	units: [
		{
			id: 'kernel.impact',
			growth: [
				{ commit: first, record: 'r', emitted: { process: 3, wasm: 5 } },
				{ commit: swapped, record: 'r', emitted: { process: 7, wasm: 1 } },
				{ commit: approved, record: 'r', emitted: { process: 7, wasm: 1 } },
				{ commit: vanished, record: 'r', emitted: { process: 7 }, ...missing },
				{ commit: later, record: 'r', emitted: { process: 7 }, ...missing }
			],
			// In the order the ledger holds them: the first baseline, then the approval of the growth.
			reviews: [
				review('baseline', first, undefined, keyed(3, 5)),
				review('approval', swapped, keyed(3, 5), keyed(7, 1))
			]
		}
	]
} as unknown as HarnessIndex;

test('growth has each target commit by commit with the limit it was verified under and the review of it', () => {
	const growth = harnessEmittedGrowth(index, 'kernel.impact');
	expect(growth.targets).toEqual([
		{ id: 'process', label: 'process (native)' },
		{ id: 'wasm', label: 'Wasm' }
	]);
	expect(
		growth.rows.map((row) => [row.commit, row.cells.process, row.cells.wasm, row.changed])
	).toEqual([
		[first, { value: 3 }, { value: 5 }, false],
		[swapped, { value: 7, delta: 4, limit: 3 }, { value: 1, delta: -4, limit: 5 }, true],
		[approved, { value: 7, limit: 7 }, { value: 1, limit: 1 }, false],
		[vanished, { value: 7, limit: 7 }, { note: 'It was not built.', limit: 1 }, true],
		[later, { value: 7, limit: 7 }, { note: 'It was not built.', limit: 1 }, false]
	]);
	expect(growth.rows[0].reviews).toEqual([
		{
			type: 'baseline',
			reviewer: 'Reviewer One',
			reason: 'Reviewed',
			changes: ['process (native) 3', 'Wasm 5']
		}
	]);
	expect(growth.rows[1].reviews[0]).toMatchObject({
		type: 'approval',
		changes: ['process (native) 3 → 7', 'Wasm 5 → 1']
	});
	expect(growth.rows[1].subject).toBe('commit b');
	expect(harnessEmittedGrowth(index, 'unknown.unit')).toEqual({ targets: [], rows: [] });
});
