import { test } from 'vitest';
import type { BenchmarkTrialInput } from '../../src/cli/program/benchmark-service/benchmarkTrial.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Describes the benchmark trial input shape', () => {
	const input: BenchmarkTrialInput = {
		run: {} as BenchmarkTrialInput['run'],
		trial: {} as BenchmarkTrialInput['trial'],
		candidate: {} as BenchmarkTrialInput['candidate'],
		runner: {
			preflight: async () => 'ready',
			run: async () => ({}) as Awaited<ReturnType<BenchmarkTrialInput['runner']['run']>>
		},
		directory: '/tmp/benchmark-trial-001',
		files: ['README.md', 'src/index.ts'],
		signal: new AbortController().signal,
		persist: async () => undefined
	};
	const output = {
		directory: input.directory,
		files: input.files,
		hasAbortSignal: input.signal instanceof AbortSignal,
		hasPersist: typeof input.persist === 'function'
	};

	expect(output).toEqual({
		directory: '/tmp/benchmark-trial-001',
		files: ['README.md', 'src/index.ts'],
		hasAbortSignal: true,
		hasPersist: true
	});
	recordExampleCases(
		{
			unitId: 'entry.program-benchmark-service-benchmark-trial-types',
			symbol: 'BenchmarkTrialInput',
			state: 'describes-the-benchmark-trial-input-shape',
			evidence: 'examples-cases',
			file: 'describes-the-benchmark-trial-input-shape.json'
		},
		[
			{
				name: 'summarizes the fields consumed by a benchmark trial',
				input: { directory: input.directory, files: input.files },
				output
			}
		]
	);
});
