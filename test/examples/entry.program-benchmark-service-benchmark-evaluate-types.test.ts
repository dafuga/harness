import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { BenchmarkSetupError } from '../../src/cli/program/benchmark-service/benchmarkEvaluate.types';

test('Creates a named benchmark setup error', () => {
	const message = 'Benchmark workspace is unavailable';
	const error = new BenchmarkSetupError(message);
	expect(error).toBeInstanceOf(Error);
	expect(error.name).toBe('BenchmarkSetupError');
	expect(error.message).toBe(message);
	recordExampleCases(
		{
			unitId: 'entry.program-benchmark-service-benchmark-evaluate-types',
			symbol: 'BenchmarkSetupError.constructor',
			state: 'creates-a-named-benchmark-setup-error',
			evidence: 'examples-cases',
			file: 'creates-a-named-benchmark-setup-error.json'
		},
		[
			{
				name: 'preserves the setup message and error identity',
				input: { message },
				output: { name: error.name, message: error.message }
			}
		]
	);
});
