import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { harnessEmitted } from '../../src/utils/harnessEmitted';
import type { Unit, Snapshot } from './reports.function.harness-emitted.test.types';

const unitId = 'kernel.impact';

/** A unit whose declared targets and emitted limits are given; no limit and no exception otherwise. */
const unit = (
	targets: string[],
	limits: Record<string, number> = {},
	unmeasured: Record<string, string> = {}
): Unit =>
	({
		id: unitId,
		runtime: {
			kind: 'process',
			targets: targets.map((kind) => ({ kind, entry: `target/${kind}` }))
		},
		emitted: { limits, unmeasured }
	}) as unknown as Unit;

const size = (target: string | undefined, value: number | null, extra: object = {}) => ({
	unit: unitId,
	metric: 'artifact-bytes',
	unitOfMeasure: 'bytes',
	value,
	workload: null,
	profile: null,
	...(target ? { target } : {}),
	...extra
});

const finding = (
	target: string,
	status: string,
	baseline: number | null,
	measured: number | null
) => ({
	unit: unitId,
	metric: 'artifact-bytes',
	target,
	status,
	baseline,
	measured
});

const snapshot = (measurements: object[], findings: object[] = []) =>
	({ measurements, budgets: { findings } }) as unknown as Snapshot;

function meta(state: string) {
	return {
		unitId: 'reports.function.harness-emitted',
		symbol: 'harnessEmitted',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('Reads each target with its own measured bytes and its own limit', () => {
	const kernel = unit(['process', 'wasm'], { process: 402048, wasm: 150000 });
	const measured = snapshot([
		size('process', 402048),
		size('wasm', 143132),
		// A benchmark's own run of the process target is not the artifact size and must not show.
		size('process', 1, { profile: 'machine' })
	]);
	const lines = harnessEmitted(kernel, measured);
	expect(lines).toEqual([
		{
			target: 'process',
			label: 'process (native)',
			value: '402048 bytes',
			limit: 'frozen at 402048 bytes'
		},
		{ target: 'wasm', label: 'Wasm', value: '143132 bytes', limit: 'frozen at 150000 bytes' }
	]);
	recordExampleCases(meta('reads-each-target-with-its-own-measured-bytes-and-its-own-limit'), [
		{
			name: 'Process and Wasm sizes are read separately with their own limits',
			input: { unit: kernel, record: measured },
			output: lines
		}
	]);
});

test('Reads an unbuilt target as an explicit row with its own note, never as zero', () => {
	const kernel = unit(['process', 'wasm'], { process: 3, wasm: 1 });
	const gone = snapshot(
		[
			size('process', 7),
			size('wasm', null, { unavailable: 'target/wasm was not built in the verified snapshot.' })
		],
		[finding('process', 'exceeded', 3, 7), finding('wasm', 'missing-measurement', 1, null)]
	);
	const unbuilt = harnessEmitted(kernel, gone);
	expect(unbuilt).toEqual([
		{
			target: 'process',
			label: 'process (native)',
			value: '7 bytes',
			limit: 'frozen at 3 bytes',
			note: 'Grew from 3 to 7 bytes without a recorded approval.'
		},
		{
			target: 'wasm',
			label: 'Wasm',
			value: 'unavailable: target/wasm was not built in the verified snapshot.',
			limit: 'frozen at 1 byte',
			note: 'Was 1 byte at its baseline and can no longer be measured.'
		}
	]);
	recordExampleCases(
		meta('reads-an-unbuilt-target-as-an-explicit-row-with-its-own-note-never-as-zero'),
		[
			{
				name: 'Exceeded process and unbuilt Wasm rows keep their notes',
				input: { unit: kernel, record: gone },
				output: unbuilt
			}
		]
	);
});

test('Reads an absent record and a unit with no output as explicit rows', () => {
	const kernel = unit(['process', 'wasm'], { process: 3, wasm: 1 });
	const absent = harnessEmitted(kernel, null);
	expect(absent.map(({ value }) => value)).toEqual([
		'not measured at this revision',
		'not measured at this revision'
	]);
	const moduleUnit = unit(['module']);
	const moduleRecord = snapshot([
		size(undefined, null, { unavailable: 'A module unit emits no separate artifact.' })
	]);
	const none = harnessEmitted(moduleUnit, moduleRecord);
	expect(none).toEqual([
		{
			target: 'none',
			label: '',
			value: 'none: A module unit emits no separate artifact.',
			limit: 'no limit applies'
		}
	]);
	recordExampleCases(meta('reads-an-absent-record-and-a-unit-with-no-output-as-explicit-rows'), [
		{
			name: 'Absent record reads as not measured for each target',
			input: { unit: kernel, record: null },
			output: absent
		},
		{
			name: 'Unit without process or Wasm output reads one none row',
			input: { unit: moduleUnit, record: moduleRecord },
			output: none
		}
	]);
});
