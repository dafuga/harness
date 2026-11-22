import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { BenchmarkOptions } from '../../src/cli/program/benchmark-service/BenchmarkService.types';

test('Accepts JSON and seed benchmark options', () => {
	const options: BenchmarkOptions = { json: true, seed: 'example-seed' };
	expect(options).toEqual({ json: true, seed: 'example-seed' });
	recordExampleCases(
		{
			unitId: 'entry.program-benchmark-service-benchmark-service-types',
			symbol: 'BenchmarkOptions',
			state: 'accepts-json-and-seed-benchmark-options',
			evidence: 'examples-cases',
			file: 'accepts-json-and-seed-benchmark-options.json'
		},
		[
			{
				name: 'sets JSON output and a reproducible seed',
				input: { json: true, seed: 'example-seed' },
				output: { json: options.json, seed: options.seed }
			}
		]
	);
});
