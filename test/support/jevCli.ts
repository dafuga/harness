import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CommandResult } from './cli';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function runJevCli(cwd: string, args: string[], scenario = 'meets'): Promise<CommandResult> {
	return new Promise((resolveResult, reject) => {
		const child = spawn(
			'bun',
			[
				'--preload',
				join(repoRoot, 'test/support/jevPreload.ts'),
				join(repoRoot, 'src/index.ts'),
				...args
			],
			{
				cwd,
				env: {
					...process.env,
					HARNESS_JEV_API_KEY: 'synthetic-test-key',
					TEST_JEV_SCENARIO: scenario
				},
				stdio: 'pipe'
			}
		);
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
		child.once('error', reject);
		child.once('exit', (code) =>
			resolveResult({
				exitCode: code ?? 1,
				stdout: Buffer.concat(stdout).toString('utf8'),
				stderr: Buffer.concat(stderr).toString('utf8')
			})
		);
	});
}
