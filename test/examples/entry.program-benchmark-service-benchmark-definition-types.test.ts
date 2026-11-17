import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type {
	BenchmarkRunners,
	PreparedBenchmark
} from '../../src/cli/program/benchmark-service/benchmarkDefinition.types';

test('Describes prepared benchmark data and runner pairs', () => {
	const runners: BenchmarkRunners = {
		codex: {
			preflight: async () => 'codex 1.0',
			run: async () => ({}) as never
		},
		claude: {
			preflight: async () => 'claude 2.0',
			run: async () => ({}) as never
		}
	};
	const prepared: PreparedBenchmark = {
		definition: {} as PreparedBenchmark['definition'],
		project: 'demo-project',
		revision: 'abc123',
		fingerprint: 'sha256:demo',
		runnerVersions: { codex: '1.0', claude: '2.0' },
		trials: 3
	};
	expect(Object.keys(runners).sort()).toEqual(['claude', 'codex']);
	expect(prepared.trials).toBe(3);
	recordExampleCases(
		{
			unitId: 'entry.program-benchmark-service-benchmark-definition-types',
			symbol: 'BenchmarkRunners and PreparedBenchmark',
			state: 'describes-prepared-benchmark-data-and-runner-pairs',
			evidence: 'examples-cases',
			file: 'describes-prepared-benchmark-data-and-runner-pairs.json'
		},
		[
			{
				name: 'paired benchmark runners',
				input: ['codex', 'claude'],
				output: Object.keys(runners).sort()
			},
			{
				name: 'prepared benchmark summary',
				input: { project: 'demo-project', revision: 'abc123', trials: 3 },
				output: {
					project: prepared.project,
					revision: prepared.revision,
					trials: prepared.trials,
					runnerVersions: prepared.runnerVersions
				}
			}
		]
	);
});
