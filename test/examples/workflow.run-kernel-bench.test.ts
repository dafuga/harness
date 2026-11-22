import { afterEach, test, vi } from 'vitest';
import { ExpectedCliError } from '../../src/core/development-tooling/errors';
import type { KernelBenchmark } from '../../src/core/development-tooling/benchmarkTypes';
import { renderBench, runKernelBench } from '../../src/cli/program/run-kernel-bench/runKernelBench';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const unitId = 'workflow.run-kernel-bench';
const evidence = 'examples-cases';
const profileId = 'a1b2c3d4e5f60718';
const revision = '0123456789abcdef0123456789abcdef01234567';
const rule = 'Lowest median cold latency wins for the selected workload.';

const benchmark = {
	schemaVersion: 1,
	contract: 'impact-kernel/1',
	recordedAt: '2026-11-15T10:00:00.000Z',
	profile: {
		id: profileId,
		platform: 'linux',
		arch: 'x64',
		cpu: 'Fixture CPU',
		cores: 8,
		memoryBytes: 17179869184,
		runtime: 'bun fixture'
	},
	source: { commit: revision, dirty: false },
	provenance: {
		kind: 'calibration',
		verified: false,
		note: 'Local observations; not verification evidence or a budget baseline.'
	},
	workloads: [
		{
			id: 'graph-100',
			nodes: 100,
			edges: 205,
			changed: 4,
			requestBytes: 6100,
			responseBytes: 4200
		}
	],
	measurements: [
		{
			unit: 'kernel.impact-kernel',
			metric: 'latency-cold-ms',
			unitOfMeasure: 'ms',
			value: 0.12,
			method: 'Median of three fresh-process samples.',
			workload: 'graph-100',
			profile: profileId,
			target: 'module',
			samples: 3,
			testedRevision: revision,
			artifacts: []
		},
		{
			unit: 'kernel.impact-kernel',
			metric: 'latency-warm-ms',
			unitOfMeasure: 'ms',
			value: null,
			unavailable: 'Not measured in this fixture.',
			method: 'Not measured.',
			workload: 'graph-100',
			profile: profileId,
			target: 'module',
			testedRevision: revision,
			artifacts: []
		}
	],
	default: {
		runtime: 'module',
		basis: 'measured',
		workload: 'graph-100',
		profile: profileId,
		rule,
		candidates: [{ runtime: 'module', coldMs: 0.12 }],
		excluded: [{ runtime: 'http', reason: 'Requires an independently served unit.' }]
	}
} satisfies KernelBenchmark;

afterEach(() => {
	vi.unstubAllEnvs();
});

test('rejects when required kernel artifacts are missing', async () => {
	await withTempDir('run-kernel-bench-examples-', async (directory) => {
		vi.stubEnv('HARNESS_KERNEL_DIR', directory);
		const input = {
			root: directory,
			quick: true,
			write: false,
			cli: ['harness-fixture']
		};
		const result = runKernelBench(input);
		await expect(result).rejects.toBeInstanceOf(ExpectedCliError);
		const message = await result.catch((error: Error) => error.message);
		expect(message).toBe('Build the kernel first: bun run build:kernel.');
		recordExampleCases(
			{
				unitId,
				symbol: 'runKernelBench',
				state: 'rejects-when-required-kernel-artifacts-are-missing',
				evidence,
				file: 'rejects-when-required-kernel-artifacts-are-missing.json'
			},
			[
				{
					name: 'quick benchmark request with no built kernel artifacts',
					input,
					error: message
				}
			]
		);
	});
});

test('renders missing metrics and the selected default', () => {
	const report = renderBench(benchmark);
	expect(report).toBe(
		[
			'Impact kernel benchmark on Fixture CPU (bun fixture).',
			'  graph-100  module   cold 0.120 ms  warm n/a ms  n/a ops/s',
			'  graph-100  wasm     cold n/a ms  warm n/a ms  n/a ops/s',
			'  graph-100  process  cold n/a ms  warm n/a ms  n/a ops/s',
			'  graph-100  http     cold n/a ms  warm n/a ms  n/a ops/s',
			`Default: module (measured on graph-100). ${rule}`,
			'Provenance: calibration from a clean tree; not verification evidence or a budget baseline.'
		].join('\n')
	);
	recordExampleCases(
		{
			unitId,
			symbol: 'renderBench',
			state: 'renders-missing-metrics-and-the-selected-default',
			evidence,
			file: 'renders-missing-metrics-and-the-selected-default.json'
		},
		[
			{
				name: 'one workload with a measured cold value and unavailable warm metrics',
				input: benchmark,
				output: report
			}
		]
	);
});
