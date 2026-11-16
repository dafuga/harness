import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import {
	kernelDefault,
	kernelParity,
	kernelSample,
	parityProblems,
	renderDefault,
	runtimeKind
} from '../../src/cli/program/run-kernel/runKernel';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const selectionRule =
	'Lowest median cold end-to-end latency on the representative workload for this profile; ' +
	'within 5% the simpler runtime wins (module, then wasm, then process). ' +
	'Unmeasured or unavailable runtimes are never chosen.';

function calibrationFixture(profile: string, commit: string) {
	const measurement = {
		unit: 'workflow.run-kernel',
		metric: 'latency-cold-ms',
		unitOfMeasure: 'ms',
		method: 'One cold runtime invocation',
		workload: 'graph-1k',
		profile,
		testedRevision: commit,
		artifacts: []
	};
	return {
		schemaVersion: 1,
		contract: 'impact-kernel/1',
		recordedAt: '2026-11-16T12:00:00.000Z',
		profile: {
			id: profile,
			platform: 'fixture-os',
			arch: 'fixture-arch',
			cpu: 'Example CPU',
			cores: 8,
			memoryBytes: 8589934592,
			runtime: 'bun fixture'
		},
		source: { commit, dirty: false },
		provenance: { kind: 'calibration', verified: false, note: 'Example calibration run' },
		workloads: [
			{ id: 'graph-1k', nodes: 1000, edges: 1600, changed: 24, requestBytes: 1024, responseBytes: 256 }
		],
		measurements: [
			{ ...measurement, value: 3.2, target: 'module' },
			{ ...measurement, value: 3.1, target: 'wasm' }
		],
		default: {
			runtime: 'module',
			basis: 'measured',
			workload: 'graph-1k',
			profile,
			rule: selectionRule,
			candidates: [],
			excluded: []
		}
	};
}

test('Reports parity when kernel builds are missing', async () => {
	await withTempDir('run-kernel-parity-', async (directory) => {
		vi.stubEnv('HARNESS_KERNEL_DIR', directory);
		try {
			const report = await kernelParity();
			const problems = parityProblems(report);
			expect(report).toMatchObject({
				contract: 'impact-kernel/1',
				cases: 150,
				status: 'incomplete',
				runtimes: [
					{ runtime: 'wasm', available: false, mismatches: 0 },
					{ runtime: 'process', available: false, mismatches: 0 }
				]
			});
			expect(problems).toEqual([
				'wasm runtime is not built; run bun run build:kernel',
				'process runtime is not built; run bun run build:kernel'
			]);
			recordExampleCases(
				{
					unitId: 'workflow.run-kernel',
					symbol: 'kernelParity',
					state: 'reports-parity-when-kernel-builds-are-missing',
					evidence: 'examples-cases',
					file: 'reports-parity-when-kernel-builds-are-missing.json'
				},
				[
					{
						name: 'temporary artifact directory without build.json',
						input: { kernelArtifactDirectory: directory },
						output: { report, problems }
					}
				]
			);
		} finally {
			vi.unstubAllEnvs();
		}
	});
});

test('Selects and renders a measured kernel default', async () => {
	await withTempDir('run-kernel-default-', async (directory) => {
		const file = join(directory, 'profile.json');
		const profile = '9c4e1a7f03b2d6e8';
		const commit = '4f1c9a2e7b8d03c5e6a1f9b4d2c7e0a8b3f5d619';
		await writeFile(file, JSON.stringify(calibrationFixture(profile, commit)));
		const report = kernelDefault(file);
		const rendered = renderDefault(report);
		expect(report.runtime).toBe('module');
		expect(report.basis).toBe('measured');
		expect(rendered).toContain('Default runtime: module (measured; calibration from a clean tree, not verified).');
		recordExampleCases(
			{
				unitId: 'workflow.run-kernel',
				symbol: 'kernelDefault',
				state: 'selects-and-renders-a-measured-kernel-default',
				evidence: 'examples-cases',
				file: 'selects-and-renders-a-measured-kernel-default.json'
			},
			[
				{
					name: 'module is within five percent of the faster wasm result',
					input: { measurements: file },
					output: { report, rendered }
				}
			]
		);
	});
});

test('Accepts all declared kernel runtime kinds', () => {
	const inputs = ['module', 'wasm', 'process', 'http'];
	const cases = inputs.map((input) => ({ name: `accepts ${input}`, input, output: runtimeKind(input) }));
	const outputs = cases.map(({ output }) => output);
	expect(outputs).toEqual(inputs);
	recordExampleCases(
		{
			unitId: 'workflow.run-kernel',
			symbol: 'runtimeKind',
			state: 'accepts-all-declared-kernel-runtime-kinds',
			evidence: 'examples-cases',
			file: 'accepts-all-declared-kernel-runtime-kinds.json'
		},
		cases
	);
});

test('Times one cold module kernel call', async () => {
	const input = { runtime: 'module', nodes: 12, seed: 12345 };
	const output = await kernelSample(input);
	expect(output.elapsedMs).toBeGreaterThanOrEqual(0);
	recordExampleCases(
		{
			unitId: 'workflow.run-kernel',
			symbol: 'kernelSample',
			state: 'times-one-cold-module-kernel-call',
			evidence: 'examples-cases',
			file: 'times-one-cold-module-kernel-call.json'
		},
		[{ name: '12-node seeded module request', input, output }]
	);
});
