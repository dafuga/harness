import type { RecordedMeasurement } from './function.choose-runtime.test.types';
import { test } from 'vitest';
import { chooseRuntime } from '../../src/utils/execution-runtimes/chooseRuntime';
import type { RuntimeChoiceInput } from '../../src/utils/execution-runtimes/chooseRuntime.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const unitId = 'function.choose-runtime';
const symbol = 'chooseRuntime';
const evidence = 'examples-cases';
const workload = 'evidence-grid-render';
const darwin = 'darwin-arm64';
const linux = 'linux-x64';
const rule =
	'Lowest median cold end-to-end latency on the representative workload for this profile; ' +
	'within 5% the simpler runtime wins (module, then wasm, then process). ' +
	'Unmeasured or unavailable runtimes are never chosen.';
const httpReason = 'Needs an independently served unit; never chosen automatically.';
const notMeasured = 'No measurement for this workload and profile.';
const buildFailed = 'Module build failed for this profile.';
const unmeasuredModule = {
	runtime: 'module',
	basis: 'unmeasured',
	workload,
	profile: linux,
	rule,
	candidates: []
};

/** A cold-latency measurement as the repository stores it, without its tested revision. */
function cold(
	profile: string,
	target: NonNullable<RecordedMeasurement['target']>,
	value: number | null,
	unavailable?: string
): RecordedMeasurement {
	return {
		unit: 'reports.component.evidence-grid',
		metric: 'latency-cold-ms',
		unitOfMeasure: 'ms',
		value,
		...(unavailable === undefined ? {} : { unavailable }),
		method: 'median cold end-to-end latency',
		workload,
		profile,
		target,
		artifacts: []
	};
}

/** The input a caller passes: the measurements of one workload and profile to choose from. */
function choiceInput(measurements: RecordedMeasurement[], profile: string): RuntimeChoiceInput {
	return { measurements, workload, profile };
}

test('chooseRuntime picks the fastest candidate and excludes HTTP', () => {
	const state = 'chooseruntime-picks-the-fastest-candidate-and-excludes-http';
	const measurements = [
		cold(darwin, 'module', 14.2),
		cold(darwin, 'wasm', 12.4),
		cold(darwin, 'process', 41.7),
		cold(darwin, 'http', 9.8)
	];
	const input = choiceInput(measurements, darwin);
	const choice = chooseRuntime(input);
	expect(choice).toEqual({
		runtime: 'wasm',
		basis: 'measured',
		workload,
		profile: darwin,
		rule,
		candidates: [
			{ runtime: 'module', coldMs: 14.2 },
			{ runtime: 'wasm', coldMs: 12.4 },
			{ runtime: 'process', coldMs: 41.7 }
		],
		excluded: [{ runtime: 'http', reason: httpReason }]
	});
	recordExampleCases({ unitId, symbol, state, evidence, file: `${state}.json` }, [
		{
			name: 'darwin-arm64: wasm (12.4 ms) is fastest; HTTP (9.8 ms) is excluded',
			input,
			output: choice
		}
	]);
});

test('chooseRuntime keeps the simpler runtime within tolerance', () => {
	const state = 'chooseruntime-keeps-the-simpler-runtime-within-tolerance';
	const within = choiceInput([cold(linux, 'module', 10.3), cold(linux, 'wasm', 9.9)], linux);
	const beyond = choiceInput([cold(linux, 'module', 10.6), cold(linux, 'wasm', 9.9)], linux);
	const keptModule = chooseRuntime(within);
	const wasmWins = chooseRuntime(beyond);
	expect(keptModule).toEqual({
		runtime: 'module',
		basis: 'measured',
		workload,
		profile: linux,
		rule,
		candidates: [
			{ runtime: 'module', coldMs: 10.3 },
			{ runtime: 'wasm', coldMs: 9.9 }
		],
		excluded: [{ runtime: 'process', reason: notMeasured }]
	});
	expect(wasmWins).toEqual({
		runtime: 'wasm',
		basis: 'measured',
		workload,
		profile: linux,
		rule,
		candidates: [
			{ runtime: 'module', coldMs: 10.6 },
			{ runtime: 'wasm', coldMs: 9.9 }
		],
		excluded: [{ runtime: 'process', reason: notMeasured }]
	});
	recordExampleCases({ unitId, symbol, state, evidence, file: `${state}.json` }, [
		{
			name: 'linux-x64: module at 10.3 ms is kept over wasm at 9.9 ms, within 5%',
			input: within,
			output: keptModule
		},
		{
			name: 'linux-x64: module at 10.6 ms gives way to wasm at 9.9 ms, beyond 5%',
			input: beyond,
			output: wasmWins
		}
	]);
});

test('chooseRuntime returns unmeasured module with no candidate', () => {
	const state = 'chooseruntime-returns-unmeasured-module-with-no-candidate';
	const unavailable = choiceInput([cold(linux, 'module', null, buildFailed)], linux);
	const unrecorded = choiceInput([], linux);
	const unavailableChoice = chooseRuntime(unavailable);
	const unrecordedChoice = chooseRuntime(unrecorded);
	expect(unavailableChoice).toEqual({
		...unmeasuredModule,
		excluded: [
			{ runtime: 'module', reason: buildFailed },
			{ runtime: 'wasm', reason: notMeasured },
			{ runtime: 'process', reason: notMeasured }
		]
	});
	expect(unrecordedChoice).toEqual({
		...unmeasuredModule,
		excluded: [
			{ runtime: 'module', reason: notMeasured },
			{ runtime: 'wasm', reason: notMeasured },
			{ runtime: 'process', reason: notMeasured }
		]
	});
	recordExampleCases({ unitId, symbol, state, evidence, file: `${state}.json` }, [
		{
			name: 'linux-x64: module build failed, so module is returned unmeasured',
			input: unavailable,
			output: unavailableChoice
		},
		{
			name: 'linux-x64: no measurements recorded, so every runtime is excluded as unmeasured',
			input: unrecorded,
			output: unrecordedChoice
		}
	]);
});
