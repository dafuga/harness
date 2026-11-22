import { join, relative } from 'node:path';
import { test } from 'vitest';
import type { KernelBenchmark } from '../../src/core/development-tooling/benchmarkTypes';
import { MeasurementRepository } from '../../src/repositories/verification-evidence/MeasurementRepository';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const sha = '0123456789abcdef0123456789abcdef01234567';

const benchmark = {
	schemaVersion: 1,
	contract: 'kernel-benchmark-contract-v1',
	recordedAt: '2026-11-14T12:00:00.000Z',
	profile: {
		id: 'linux-x64-node22',
		platform: 'linux',
		arch: 'x64',
		cpu: 'generic x86_64',
		cores: 8,
		memoryBytes: 17179869184,
		runtime: 'Node.js 22'
	},
	source: { commit: sha, dirty: false },
	provenance: {
		kind: 'calibration',
		verified: false,
		note: 'Observational measurements from a local benchmark run. They are not verification evidence and cannot establish or satisfy a budget baseline.'
	},
	workloads: [
		{ id: 'graph-1k', nodes: 1000, edges: 3000, changed: 1, requestBytes: 128, responseBytes: 256 }
	],
	measurements: [
		{
			unit: 'repository.measurement',
			metric: 'latency-cold-ms',
			unitOfMeasure: 'ms',
			value: 12.4,
			method: 'isolated kernel benchmark',
			workload: 'graph-1k',
			profile: 'linux-x64-node22',
			target: 'module',
			samples: 5,
			testedRevision: sha,
			artifacts: [
				{
					path: 'specification/measurements/impact-kernel/linux-x64-node22.json',
					sha256: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
					bytes: 512
				}
			]
		}
	],
	default: {
		runtime: 'module',
		basis: 'measured',
		workload: 'graph-1k',
		profile: 'linux-x64-node22',
		rule: 'lowest measured cold latency',
		candidates: [{ runtime: 'module', coldMs: 12.4 }],
		excluded: []
	}
} as KernelBenchmark;

function captureError(run: () => unknown): { name: string; message: string } {
	try {
		run();
	} catch (caught) {
		const error = caught as Error;
		return { name: error.name, message: error.message };
	}
	return { name: 'none', message: 'did not throw' };
}

test('Writes a run to its profile path and reads it back', async () => {
	await withTempDir('measurement-profile-', async (directory) => {
		const repository = new MeasurementRepository(directory);
		const path = await repository.write(benchmark);
		const stored = relative(directory, path);
		expect(stored.endsWith('linux-x64-node22.json')).toBe(true);
		expect(repository.read(stored)).toEqual(benchmark);
		recordExampleCases(
			{
				unitId: 'repository.measurement',
				symbol: 'write',
				state: 'writes-a-run-to-its-profile-path-and-reads-it-back',
				evidence: 'examples-cases',
				file: 'writes-a-run-to-its-profile-path-and-reads-it-back.json'
			},
			[
				{
					name: 'default write derives the profile filename and round-trips through read',
					input: { profile: benchmark.profile.id },
					output: { file: stored, measurements: benchmark.measurements.length }
				}
			]
		);
	});
});

test('Writes a run to an explicit file under the root', async () => {
	await withTempDir('measurement-explicit-', async (directory) => {
		const repository = new MeasurementRepository(directory);
		const file = 'specification/measurements/impact-kernel/custom-run.json';
		const path = await repository.write(benchmark, file);
		expect(path).toBe(join(directory, file));
		expect(repository.read(file)).toEqual(benchmark);
		recordExampleCases(
			{
				unitId: 'repository.measurement',
				symbol: 'write',
				state: 'writes-a-run-to-an-explicit-file-under-the-root',
				evidence: 'examples-cases',
				file: 'writes-a-run-to-an-explicit-file-under-the-root.json'
			},
			[
				{
					name: 'explicit file is resolved against the root and parent folders are created',
					input: { file },
					output: { path: relative(directory, path) }
				}
			]
		);
	});
});

test('Returns the repository profile run before shipped runs', async () => {
	await withTempDir('measurement-for-profile-', async (directory) => {
		const repository = new MeasurementRepository(directory);
		await repository.write(benchmark);
		const found = repository.forProfile('linux-x64-node22');
		expect(found).toEqual(benchmark);
		recordExampleCases(
			{
				unitId: 'repository.measurement',
				symbol: 'forProfile',
				state: 'returns-the-repository-profile-run-before-shipped-runs',
				evidence: 'examples-cases',
				file: 'returns-the-repository-profile-run-before-shipped-runs.json'
			},
			[
				{
					name: 'stored profile run is returned for its profile id',
					input: { profile: 'linux-x64-node22' },
					output: { profile: found?.profile.id, measurements: found?.measurements.length }
				}
			]
		);
	});
});

test('Rejects reading a measurement file that does not exist', async () => {
	await withTempDir('measurement-missing-', (directory) => {
		const repository = new MeasurementRepository(directory);
		const file = 'specification/measurements/impact-kernel/missing.json';
		const error = captureError(() => repository.read(file));
		expect(error.message).toContain('does not exist');
		recordExampleCases(
			{
				unitId: 'repository.measurement',
				symbol: 'read',
				state: 'rejects-reading-a-measurement-file-that-does-not-exist',
				evidence: 'examples-cases',
				file: 'rejects-reading-a-measurement-file-that-does-not-exist.json'
			},
			[{ name: 'missing measurement file rejects with its name in the message', input: { file }, error }]
		);
	});
});
