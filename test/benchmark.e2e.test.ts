import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { installBenchmarkExecutables } from './support/benchmarkExecutable';
import { runCommand, runHarness } from './support/cli';

test('benchmark validation pins a contract task without changing the checkout', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-benchmark-cli-'));
	try {
		const bin = await installBenchmarkExecutables(root);
		vi.stubEnv('PATH', `${bin}:${process.env.PATH}`);
		await runCommand(['git', 'init', '-q'], root);
		await writeFile(join(root, 'component.ts'), 'export const value = 0;\n');
		await writeFile(join(root, 'check.ts'), 'process.exit(0);\n');
		await runCommand(['git', 'add', '.'], root);
		await runCommand(
			[
				'git',
				'-c',
				'user.name=Test',
				'-c',
				'user.email=test@example.com',
				'commit',
				'-qm',
				'fixture'
			],
			root
		);
		await writeFile(
			join(root, 'benchmark.json'),
			JSON.stringify({
				version: 1,
				name: 'component-value',
				task: 'Return one',
				contract: 'Export value equal to 1',
				allowedFiles: ['component.ts'],
				checks: [{ id: 'contract', command: 'bun check.ts' }],
				candidates: [{ id: 'codex', runner: 'codex', model: 'explicit-model', effort: 'medium' }]
			})
		);
		const guidance = await runHarness(['info', 'benchmark', '--json'], root);
		expect(JSON.parse(guidance.stdout).topic).toBe('benchmark');
		const before = await runCommand(['git', 'status', '--porcelain'], root);
		const result = await runHarness(
			['benchmark', 'validate', 'benchmark.json', '--json'],
			root,
			false
		);
		expect(result.exitCode, result.stderr).toBe(0);
		const preview = JSON.parse(result.stdout);
		expect(preview.revision).toMatch(/^[a-f0-9]{40}$/);
		expect(preview.trials).toBe(3);
		expect(preview.definition.budget).toEqual({ repetitions: 3, timeoutMs: 900000, repairs: 2 });
		expect((await runCommand(['git', 'status', '--porcelain'], root)).stdout).toBe(before.stdout);
	} finally {
		vi.unstubAllEnvs();
		await rm(root, { recursive: true, force: true });
	}
}, 30000);
