import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { resourceEnvironment } from '../../src/utils/execution-runtimes/resourceEnvironment';

const leaseEnv = {
	HARNESS_RESOURCES_HOME: '/opt/harness/resources',
	HARNESS_RESOURCE_CPUS: '4',
	HARNESS_RESOURCE_MEMORY_MIB: '8192',
	PATH: '/usr/local/bin:/usr/bin:/bin'
};
const leaseOutput = {
	HARNESS_RESOURCES_HOME: '/opt/harness/resources',
	HARNESS_RESOURCE_CPUS: '4',
	HARNESS_RESOURCE_MEMORY_MIB: '8192'
};
const workerEnv = {
	CARGO_BUILD_JOBS: '8',
	RAYON_NUM_THREADS: '8',
	GOMAXPROCS: '4',
	OMP_NUM_THREADS: '4',
	LANG: 'en_US.UTF-8'
};
const workerOutput = {
	CARGO_BUILD_JOBS: '8',
	RAYON_NUM_THREADS: '8',
	GOMAXPROCS: '4',
	OMP_NUM_THREADS: '4'
};
const appOnlyEnv = { LANG: 'en_US.UTF-8', TERM: 'xterm-256color' };

test('Keeps only the resource and worker keys that are set', () => {
	expect(resourceEnvironment(leaseEnv)).toStrictEqual(leaseOutput);
	expect(resourceEnvironment(workerEnv)).toStrictEqual(workerOutput);
	expect(Object.keys(resourceEnvironment(workerEnv))).toEqual([
		'CARGO_BUILD_JOBS',
		'RAYON_NUM_THREADS',
		'GOMAXPROCS',
		'OMP_NUM_THREADS'
	]);
	recordExampleCases(
		{
			unitId: 'function.resource-environment',
			symbol: 'resourceEnvironment',
			state: 'keeps-only-the-resource-and-worker-keys-that-are-set',
			evidence: 'examples-cases',
			file: 'keeps-only-the-resource-and-worker-keys-that-are-set.json'
		},
		[
			{
				name: 'lease and CPU/memory keys are kept, PATH is dropped',
				input: leaseEnv,
				output: leaseOutput
			},
			{
				name: 'worker budget keys are kept, LANG is dropped',
				input: workerEnv,
				output: workerOutput
			}
		]
	);
});

test('Returns an empty object when no resource keys are set', () => {
	expect(resourceEnvironment(appOnlyEnv)).toStrictEqual({});
	expect(resourceEnvironment({})).toStrictEqual({});
	expect(resourceEnvironment({ HARNESS_RESOURCE_CPUS: undefined })).toStrictEqual({});
	recordExampleCases(
		{
			unitId: 'function.resource-environment',
			symbol: 'resourceEnvironment',
			state: 'returns-an-empty-object-when-no-resource-keys-are-set',
			evidence: 'examples-cases',
			file: 'returns-an-empty-object-when-no-resource-keys-are-set.json'
		},
		[
			{
				name: 'application-only environment yields no resource context',
				input: appOnlyEnv,
				output: {}
			},
			{
				name: 'empty environment yields no resource context',
				input: {},
				output: {}
			}
		]
	);
});
