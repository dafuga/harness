import { expect, test, vi } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { measurementSchema } from '../../../src/core/verificationTypes';
import { measureHarness } from './measureHarness';

test.each([
	[['plugin', 'list', '--json'], 'plugin-list'],
	[['plugin', 'list'], 'plugin-list'],
	[['plugin', 'info', 'playwright', '--json'], 'plugin-info-playwright'],
	[['plugin', 'add', 'headless-audio'], 'plugin-add-headless-audio'],
	[['plugin', 'generate', 'playwright', 'test', 'Example'], 'plugin-generate-playwright'],
	[['plugin', 'test', 'headless-audio', '--workers=1'], 'plugin-test-headless-audio'],
	[['info', 'modules'], 'info-modules']
])('CLI workload %j remains readable by committed measurement history', async (args, workload) => {
	const directory = await mkdtemp(join(tmpdir(), 'harness-cli-measurement-'));
	vi.stubEnv('HARNESS_EVIDENCE_DIR', directory);
	vi.stubEnv('TAKE_SCREENSHOT', '1');
	try {
		const root = resolve(import.meta.dirname, '../../..');
		const result = { exitCode: 0, stdout: 'fixture result', stderr: '' };
		expect(
			await measureHarness(
				{ args, cwd: root, source: root, command: ['fixture'], expectSuccess: true, env: {} },
				async (command) => {
					const usage = command[command.indexOf('-o') + 1];
					await writeFile(
						usage,
						'12345 maximum resident set size\nMaximum resident set size (kbytes): 12345\n'
					);
					return result;
				}
			)
		).toEqual(result);
		const files = (await readdir(directory)).filter((file) => file.endsWith('.json'));
		expect(files).toHaveLength(1);
		const { measurements } = JSON.parse(await readFile(join(directory, files[0]), 'utf8'));
		expect(measurements.length).toBeGreaterThan(0);
		for (const row of measurements) {
			expect(row.workload).toBe(workload);
			expect(() =>
				measurementSchema.parse({
					...row,
					profile: null,
					testedRevision: 'a'.repeat(40),
					artifacts: []
				})
			).not.toThrow();
		}
	} finally {
		vi.unstubAllEnvs();
		await rm(directory, { recursive: true, force: true });
	}
});
