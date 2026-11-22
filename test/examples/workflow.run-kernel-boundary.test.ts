import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { kernelBoundary } from '../../src/cli/program/runKernelBoundary';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Rejects when the wasm kernel artifact is missing', async () => {
	await withTempDir('kernel-boundary-missing-wasm-', async (directory) => {
		writeFileSync(join(directory, 'build.json'), '{}');
		vi.stubEnv('HARNESS_KERNEL_DIR', directory);
		let error: unknown;
		try {
			await kernelBoundary();
		} catch (caught) {
			error = caught;
		} finally {
			vi.unstubAllEnvs();
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain('wasm runtime is not built');
		recordExampleCases(
			{
				unitId: 'workflow.run-kernel-boundary',
				symbol: 'kernelBoundary',
				state: 'rejects-when-the-wasm-kernel-artifact-is-missing',
				evidence: 'examples-cases',
				file: 'rejects-when-the-wasm-kernel-artifact-is-missing.json'
			},
			[
				{
					name: 'missing wasm artifact rejects after the module target is measured',
					input: {},
					error: {
						name: (error as Error).name,
						message: (error as Error).message
					}
				}
			]
		);
	});
});
