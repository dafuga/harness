import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type {
	BenchmarkProcessInput,
	BenchmarkProcessResult
} from '../../src/cli/program/benchmark-service/benchmarkProcess.types';

test('Describes benchmark process input and result shapes', () => {
	const input: BenchmarkProcessInput = {
		command: ['node', 'bench.js'],
		cwd: '/tmp/benchmark-project',
		input: 'sample workload',
		timeoutMs: 5000
	};
	const result: BenchmarkProcessResult = {
		exitCode: 0,
		stdout: 'completed',
		stderr: ''
	};
	expect(result.exitCode).toBe(0);
	recordExampleCases(
		{
			unitId: 'entry.program-benchmark-service-benchmark-process-types',
			symbol: 'BenchmarkProcessInput and BenchmarkProcessResult',
			state: 'describes-benchmark-process-input-and-result-shapes',
			evidence: 'examples-cases',
			file: 'describes-benchmark-process-input-and-result-shapes.json'
		},
		[
			{
				name: 'valid process input and successful result',
				input: { command: input.command, cwd: input.cwd, input: input.input, timeoutMs: input.timeoutMs },
				output: result
			}
		]
	);
});
