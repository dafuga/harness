import type { Build, Measurement } from './function.bench-measurement.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { sizeMeasurements } from '../../src/cli/program/run-kernel-bench/benchMeasurement';
import {
	kernelUnits,
	benchMeasurement
} from '../../src/utils/verification-evidence/benchMeasurement';
import type {
	MeasureContext,
	Entry
} from '../../src/utils/verification-evidence/benchMeasurement.types';

const commit = '0123456789abcdef0123456789abcdef01234567';
const linuxContext: MeasureContext = { profile: 'linux-x64', commit };
const unbornContext: MeasureContext = { profile: 'linux-x64', commit: null };
const bundleReason = 'The reference ships inside the CLI bundle and has no separate artifact.';
const byteMethod = 'Byte size recorded by the kernel build.';

const sha = (character: string) => character.repeat(64);

const build: Build = {
	contract: 'fixture-contract',
	rustc: 'fixture-rustc',
	host: 'fixture-host',
	wasmOpt: null,
	wasm: { path: 'impact-kernel.wasm', bytes: 65536, sha256: sha('a') },
	native: { path: 'impact-kernel', bytes: 131072, sha256: sha('b') },
	sources: {
		reference: {
			bytes: 2048,
			files: [
				{
					path: 'src/utils/verification-evidence/benchMeasurement.ts',
					bytes: 2048,
					sha256: sha('c')
				}
			]
		},
		crate: {
			bytes: 4096,
			files: [
				{
					path: 'src/cli/program/run-kernel-bench/benchMeasurement.ts',
					bytes: 4096,
					sha256: sha('d')
				}
			]
		}
	}
};

const summary = (item: Measurement) => ({
	unit: item.unit,
	target: item.target,
	metric: item.metric,
	value: item.value,
	testedRevision: item.testedRevision,
	artifacts: item.artifacts
});

const wasmEntry: Entry = {
	target: 'wasm',
	metric: 'artifact-bytes',
	unitOfMeasure: 'bytes',
	value: 65536,
	method: byteMethod,
	artifacts: [{ path: 'impact-kernel.wasm', bytes: 65536, sha256: sha('a') }]
};

const unavailableEntry: Entry = {
	target: 'module',
	metric: 'artifact-bytes',
	unitOfMeasure: 'bytes',
	value: { unavailable: bundleReason },
	method: byteMethod
};

const latencyEntry: Entry = {
	target: 'process',
	metric: 'latency-ms',
	unitOfMeasure: 'ms',
	value: 4.5,
	method: 'Median of timed runs.',
	workload: 'impact-query',
	samples: 20
};

test('Size measurements cover all four runtime targets', () => {
	const measurements = sizeMeasurements(linuxContext, build);
	const unbornMeasurements = sizeMeasurements(unbornContext, build);

	expect(measurements).toHaveLength(7);
	expect(measurements.map(({ target, metric, value }) => [target, metric, value])).toEqual([
		['module', 'artifact-bytes', null],
		['http', 'artifact-bytes', null],
		['wasm', 'artifact-bytes', 65536],
		['process', 'artifact-bytes', 131072],
		['module', 'source-bytes', 2048],
		['wasm', 'source-bytes', 4096],
		['process', 'source-bytes', 4096]
	]);
	expect(unbornMeasurements[2]?.testedRevision).toBeNull();
	recordExampleCases(
		{
			unitId: 'function.bench-measurement',
			symbol: 'sizeMeasurements',
			state: 'size-measurements-cover-all-four-runtime-targets',
			evidence: 'examples-cases',
			file: 'size-measurements-cover-all-four-runtime-targets.json'
		},
		[
			{
				name: 'kernel build with a tested commit',
				input: { context: linuxContext, build },
				output: measurements.map(summary)
			},
			{
				name: 'kernel build with no commit keeps testedRevision null',
				input: { context: unbornContext, build },
				output: unbornMeasurements.map(summary)
			}
		]
	);
});

test('Benchmark entries keep numbers and unavailable reasons', () => {
	const results = [wasmEntry, unavailableEntry, latencyEntry].map((entry) =>
		benchMeasurement(unbornContext, entry)
	);

	expect(results[0]).toMatchObject({
		unit: kernelUnits.wasm,
		value: 65536,
		workload: null,
		testedRevision: null
	});
	expect(results[0]).not.toHaveProperty('unavailable');
	expect(results[1]).toMatchObject({
		unit: kernelUnits.module,
		value: null,
		unavailable: bundleReason,
		artifacts: []
	});
	expect(results[2]).toMatchObject({ value: 4.5, workload: 'impact-query', samples: 20 });
	recordExampleCases(
		{
			unitId: 'function.bench-measurement',
			symbol: 'benchMeasurement',
			state: 'benchmark-entries-keep-numbers-and-unavailable-reasons',
			evidence: 'examples-cases',
			file: 'benchmark-entries-keep-numbers-and-unavailable-reasons.json'
		},
		[
			{
				name: 'measured wasm artifact keeps its numeric value and artifact',
				input: { context: unbornContext, entry: wasmEntry },
				output: results[0]
			},
			{
				name: 'module entry without an artifact reports its unavailable reason',
				input: { context: unbornContext, entry: unavailableEntry },
				output: results[1]
			},
			{
				name: 'latency entry keeps workload and samples',
				input: { context: unbornContext, entry: latencyEntry },
				output: results[2]
			}
		]
	);
});
