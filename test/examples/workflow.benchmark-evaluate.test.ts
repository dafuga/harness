import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import {
	evaluateBenchmarkSubmission,
	setupBenchmarkWorkspace
} from '../../src/cli/program/benchmark-service/benchmarkEvaluate';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

const definition = {
	version: 1 as const,
	name: 'unit-smoke-check',
	project: '/workspace/project',
	revision: '0123456789abcdef0123456789abcdef01234567',
	task: 'Update the example module.',
	contract: 'Change only src/example.ts and leave the checks passing.',
	allowedFiles: ['src/example.ts'],
	checks: [{ id: 'unit-tests', command: 'test -f src/example.ts' }],
	setup: [],
	candidates: [
		{
			id: 'codex-luna',
			runner: 'codex' as const,
			model: 'gpt-6-luna',
			effort: 'high' as const,
			instructions: '',
			tools: 'default' as const
		}
	],
	budget: { repetitions: 3, timeoutMs: 900000, repairs: 2 }
};

test('Evaluates allowed changes and rejects protected file edits', async () => {
	await withTempDir('benchmark-evaluate-', async (directory) => {
		await withTempRepo(async (repo) => {
			const baseline = join(directory, 'baseline');
			const evaluation = join(directory, 'evaluation');
			await mkdir(join(baseline, 'src'), { recursive: true });
			await writeFile(join(baseline, 'src/example.ts'), 'export const value = 1;\n');
			await mkdir(join(repo.root, 'src'), { recursive: true });
			await writeFile(join(repo.root, 'src/example.ts'), 'export const value = 2;\n');
			await writeFile(join(repo.root, 'private-config.ts'), 'export const secret = false;\n');
			repo.git('add', '-A');
			repo.git(
				'-c',
				'user.name=Harness',
				'-c',
				'user.email=harness@localhost',
				'commit',
				'-qm',
				'submission'
			);
			const signal = new AbortController().signal;
			const result = await evaluateBenchmarkSubmission({
				definition,
				baseline,
				workspace: repo.root,
				evaluation,
				files: ['src/example.ts'],
				signal
			});
			expect(result.passed).toBe(false);
			expect(result.invalidFiles).toContain('private-config.ts');
			recordExampleCases(
				{
					unitId: 'workflow.benchmark-evaluate',
					symbol: 'evaluateBenchmarkSubmission',
					state: 'evaluates-allowed-changes-and-rejects-protected-file-edits',
					evidence: 'examples-cases',
					file: 'evaluates-allowed-changes-and-rejects-protected-file-edits.json'
				},
				[
					{
						name: 'protected workspace file short-circuits acceptance checks',
						input: {
							files: ['src/example.ts', 'private-config.ts'],
							allowedFiles: ['src/example.ts']
						},
						output: {
							passed: result.passed,
							invalidFiles: result.invalidFiles,
							checks: result.checks,
							patch: result.patch
						}
					}
				]
			);
		});
	});
});

test('Runs setup commands in order and stops on failure', async () => {
	await withTempDir('benchmark-setup-', async (directory) => {
		const signal = new AbortController().signal;
		await setupBenchmarkWorkspace(
			directory,
			{ ...definition, setup: ['mkdir -p ready', 'test -d ready'] },
			signal
		);
		let error: unknown;
		try {
			await setupBenchmarkWorkspace(
				directory,
				{ ...definition, setup: ['exit 7', 'touch unreachable'] },
				signal
			);
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain('setup failed');
		recordExampleCases(
			{
				unitId: 'workflow.benchmark-evaluate',
				symbol: 'setupBenchmarkWorkspace',
				state: 'runs-setup-commands-in-order-and-stops-on-failure',
				evidence: 'examples-cases',
				file: 'runs-setup-commands-in-order-and-stops-on-failure.json'
			},
			[
				{
					name: 'setup command failure rejects before later commands run',
					input: { setup: ['exit 7', 'touch unreachable'] },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	});
});
