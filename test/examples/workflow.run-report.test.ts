import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, test, vi } from 'vitest';
import { runReport } from '../../src/cli/program/run-report/runReport';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

afterEach(() => vi.unstubAllEnvs());

test('Rejects null-byte arguments before the child starts', async () => {
	await withTempDir('run-report-examples-', async (directory) => {
		const settingsFile = join(directory, 'settings.json');
		writeFileSync(settingsFile, '{}');
		vi.stubEnv('HARNESS_REPORTS_SETTINGS_FILE', settingsFile);

		const args = ['\u0000'];
		let caught: unknown;
		try {
			await runReport(args);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(TypeError);
		const error = caught as Error & { code?: string };
		const observed = { name: error.name, code: error.code ?? null };
		expect(observed).toEqual({ name: 'TypeError', code: 'ERR_INVALID_ARG_VALUE' });
		recordExampleCases(
			{
				unitId: 'workflow.run-report',
				symbol: 'runReport',
				state: 'rejects-null-byte-arguments-before-the-child-starts',
				evidence: 'examples-cases',
				file: 'rejects-null-byte-arguments-before-the-child-starts.json'
			},
			[
				{
					name: 'a null byte in the forwarded arguments',
					input: { args },
					error: observed
				}
			]
		);
	});
});
