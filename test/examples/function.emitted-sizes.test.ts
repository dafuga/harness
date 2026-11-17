import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	emittedMetric,
	emittedKey,
	emittedSizes
} from '../../src/utils/development-tooling/emittedSizes';
import type { Sized } from '../../src/utils/development-tooling/emittedSizes.types';

const frozenModule: Sized = {
	metric: 'artifact-bytes',
	target: 'module',
	profile: null,
	workload: null
};
const frozenWasm: Sized = { metric: 'artifact-bytes', target: 'wasm' };
const benchmarkModule: Sized = {
	metric: 'artifact-bytes',
	target: 'module',
	profile: 'ci-runner',
	workload: 'cold-start'
};
const untargetedSize: Sized = { metric: 'artifact-bytes' };
const otherMetric: Sized = { metric: 'duration-ms', target: 'process' };
const profileOnlyProcess: Sized = {
	metric: 'artifact-bytes',
	target: 'process',
	profile: 'ci-runner'
};
const emptyDetailsWasm: Sized = {
	metric: 'artifact-bytes',
	target: 'wasm',
	profile: '',
	workload: ''
};

const buildMeasurements: Sized[] = [
	frozenModule,
	benchmarkModule,
	untargetedSize,
	frozenWasm,
	otherMetric,
	profileOnlyProcess
];

test('Keeps only frozen per-target artifact sizes in order', () => {
	const selected = emittedSizes(buildMeasurements);

	expect(selected).toEqual([frozenModule, frozenWasm]);
	expect(selected[0]).toBe(frozenModule);
	expect(selected[1]).toBe(frozenWasm);
	recordExampleCases(
		{
			unitId: 'function.emitted-sizes',
			symbol: 'emittedSizes',
			state: 'keeps-only-frozen-per-target-artifact-sizes-in-order',
			evidence: 'examples-cases',
			file: 'keeps-only-frozen-per-target-artifact-sizes-in-order.json'
		},
		[
			{
				name: 'build sizes mixed with benchmark, untargeted and other-metric entries',
				input: buildMeasurements,
				output: [frozenModule, frozenWasm]
			},
			{
				name: 'only a benchmark size with a profile and workload is given',
				input: [benchmarkModule],
				output: []
			}
		]
	);
});

test('Names each frozen size under the artifact-bytes metric key', () => {
	expect(emittedMetric).toBe('artifact-bytes');
	expect(emittedKey('module')).toBe('artifact-bytes:module');
	expect(emittedKey('wasm')).toBe('artifact-bytes:wasm');
	expect(emittedKey('process')).toBe('artifact-bytes:process');
	recordExampleCases(
		{
			unitId: 'function.emitted-sizes',
			symbol: 'emittedKey',
			state: 'names-each-frozen-size-under-the-artifact-bytes-metric-key',
			evidence: 'examples-cases',
			file: 'names-each-frozen-size-under-the-artifact-bytes-metric-key.json'
		},
		[
			{ name: 'module target', input: 'module', output: 'artifact-bytes:module' },
			{ name: 'wasm target', input: 'wasm', output: 'artifact-bytes:wasm' },
			{ name: 'process target', input: 'process', output: 'artifact-bytes:process' }
		]
	);
});

test('Treats empty profile and workload as absent', () => {
	const selected = emittedSizes([emptyDetailsWasm, profileOnlyProcess]);

	expect(selected).toEqual([emptyDetailsWasm]);
	expect(selected[0]).toBe(emptyDetailsWasm);
	recordExampleCases(
		{
			unitId: 'function.emitted-sizes',
			symbol: 'emittedSizes',
			state: 'treats-empty-profile-and-workload-as-absent',
			evidence: 'examples-cases',
			file: 'treats-empty-profile-and-workload-as-absent.json'
		},
		[
			{
				name: 'wasm size with empty profile and workload strings is frozen',
				input: [emptyDetailsWasm],
				output: [emptyDetailsWasm]
			},
			{
				name: 'process size with a profile but no workload is excluded',
				input: [profileOnlyProcess],
				output: []
			}
		]
	);
});
