import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { RunBenchmarkInput } from '../../src/cli/program/benchmark-service/runBenchmark.types';

test('Defines benchmark invocation inputs', () => {
	const input: RunBenchmarkInput = {
		path: '/tmp/example-project',
		runners: {} as RunBenchmarkInput['runners'],
		repository: {} as RunBenchmarkInput['repository'],
		signal: new AbortController().signal,
		seed: 'example-seed',
		onProgress: () => undefined
	};
	const summary = {
		path: input.path,
		seed: input.seed,
		hasAbortSignal: input.signal instanceof AbortSignal,
		hasProgressCallback: typeof input.onProgress === 'function'
	};
	expect(summary).toEqual({
		path: '/tmp/example-project',
		seed: 'example-seed',
		hasAbortSignal: true,
		hasProgressCallback: true
	});
	recordExampleCases(
		{
			unitId: 'entry.program-benchmark-service-run-benchmark-types',
			symbol: 'RunBenchmarkInput',
			state: 'defines-benchmark-invocation-inputs',
			evidence: 'examples-cases',
			file: 'defines-benchmark-invocation-inputs.json'
		},
		[
			{
				name: 'optional invocation controls are accepted',
				input: { path: input.path, seed: input.seed },
				output: summary
			}
		]
	);
});
