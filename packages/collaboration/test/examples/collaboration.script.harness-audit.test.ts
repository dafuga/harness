import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { withTempDir } from '../../../../test/support/temporary';
import { expect } from '../../../../test/verificationExpect';
import type { Invocation, Fake } from './collaboration.script.harness-audit.test.types';

/**
 * The harness-audit script exports nothing: it is top-level code that runs `harness audit` and
 * exits with its status. Each state runs the real script file with bun, in a temporary project
 * folder where fake harness executables stand in for the CLI. What the fake received and what the
 * script returned are asserted and recorded as the cases of its state.
 */

const unitId = 'collaboration.script.harness-audit';
const scriptPath = fileURLToPath(new URL('../../scripts/harness-audit.ts', import.meta.url));
const audit = ['audit', '.', '--profile', 'lib'];

/** A fake harness CLI: it reports the runtime, file name and arguments it received, then exits. */
function writeFakeCli(path: string, exitCode: number, stderr = ''): void {
	const lines = [
		'#!/usr/bin/env bun',
		"const cli = process.argv[1].split('/').pop();",
		'const runtime = process.versions.bun ? "bun" : "node";',
		'console.log(JSON.stringify({ runtime, cli, args: process.argv.slice(2) }));',
		...(stderr ? [`console.error(${JSON.stringify(stderr)});`] : []),
		`process.exit(${exitCode});`
	];
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${lines.join('\n')}\n`);
	chmodSync(path, 0o700);
}

/**
 * Runs the real script with bun from a temporary folder. The folder's bin directory comes first on
 * PATH so a fake `harness` is found, and HOME and TMPDIR stay inside the folder. PATH is read only
 * to keep bun reachable; nothing read from the environment is recorded.
 */
function runAudit(
	root: string,
	environment: Record<string, string> = {}
): SpawnSyncReturns<string> {
	const bin = join(root, 'bin');
	const inherited = process.env.PATH;
	return spawnSync('bun', [scriptPath], {
		cwd: root,
		encoding: 'utf8',
		timeout: 15_000,
		env: {
			...environment,
			HOME: root,
			TMPDIR: root,
			PATH: inherited ? `${bin}${delimiter}${inherited}` : bin
		}
	});
}

/** The fields of a run that matter: its exit status, the CLI it ran with its args, and stderr. */
function summarise(run: SpawnSyncReturns<string>) {
	expect(run.error).toBeUndefined();
	return {
		exitCode: run.status,
		invoked: JSON.parse(run.stdout) as Invocation,
		stderr: run.stderr
	};
}

/** The made-up inputs of one run: the script, its project folder, its environment and its fake. */
function given(environment: Record<string, string>, fake: Fake) {
	return {
		script: 'packages/collaboration/scripts/harness-audit.ts',
		cwd: 'temporary project folder',
		environment,
		fake
	};
}

test('Runs the lib audit through the configured CLI with bun', async () => {
	await withTempDir('harness-audit-examples-', (root) => {
		const cli = join(root, 'harness-cli.js');
		const spaced = join(root, 'harness cli.js');
		writeFakeCli(cli, 0);
		writeFakeCli(spaced, 0);
		const plain = summarise(runAudit(root, { HARNESS_CLI_PATH: cli }));
		const withSpace = summarise(runAudit(root, { HARNESS_CLI_PATH: spaced }));
		expect(plain).toEqual({
			exitCode: 0,
			invoked: { runtime: 'bun', cli: 'harness-cli.js', args: audit },
			stderr: ''
		});
		expect(withSpace).toEqual({
			exitCode: 0,
			invoked: { runtime: 'bun', cli: 'harness cli.js', args: audit },
			stderr: ''
		});
		recordExampleCases(
			{
				unitId,
				symbol: 'harness-audit',
				state: 'runs-the-lib-audit-through-the-configured-cli-with-bun',
				evidence: 'examples-cases',
				file: 'runs-the-lib-audit-through-the-configured-cli-with-bun.json'
			},
			[
				{
					name: 'HARNESS_CLI_PATH names harness-cli.js, which exits 0',
					input: given(
						{ HARNESS_CLI_PATH: 'harness-cli.js' },
						{ file: 'harness-cli.js', exitCode: 0 }
					),
					output: plain
				},
				{
					name: 'HARNESS_CLI_PATH names a file with a space, which stays one argument',
					input: given(
						{ HARNESS_CLI_PATH: 'harness cli.js' },
						{ file: 'harness cli.js', exitCode: 0 }
					),
					output: withSpace
				}
			]
		);
	});
});

test('Runs harness from PATH when the CLI path is unset or empty', async () => {
	await withTempDir('harness-audit-examples-', (root) => {
		writeFakeCli(join(root, 'bin', 'harness'), 0);
		const unset = summarise(runAudit(root));
		const empty = summarise(runAudit(root, { HARNESS_CLI_PATH: '' }));
		const expected = {
			exitCode: 0,
			invoked: { runtime: 'bun', cli: 'harness', args: audit },
			stderr: ''
		};
		expect(unset).toEqual(expected);
		expect(empty).toEqual(expected);
		recordExampleCases(
			{
				unitId,
				symbol: 'harness-audit',
				state: 'runs-harness-from-path-when-the-cli-path-is-unset-or-empty',
				evidence: 'examples-cases',
				file: 'runs-harness-from-path-when-the-cli-path-is-unset-or-empty.json'
			},
			[
				{
					name: 'HARNESS_CLI_PATH is not set, so the harness on PATH runs',
					input: given({}, { file: 'bin/harness', exitCode: 0 }),
					output: unset
				},
				{
					name: 'HARNESS_CLI_PATH is an empty string, which also falls back to PATH',
					input: given({ HARNESS_CLI_PATH: '' }, { file: 'bin/harness', exitCode: 0 }),
					output: empty
				}
			]
		);
	});
});

test('Exits with the audit failure code and passes its output', async () => {
	await withTempDir('harness-audit-examples-', (root) => {
		const cli = join(root, 'harness-cli.js');
		writeFakeCli(cli, 1, 'audit: 2 problems found');
		writeFakeCli(join(root, 'bin', 'harness'), 2);
		const configured = summarise(runAudit(root, { HARNESS_CLI_PATH: cli }));
		const onPath = summarise(runAudit(root));
		expect(configured).toEqual({
			exitCode: 1,
			invoked: { runtime: 'bun', cli: 'harness-cli.js', args: audit },
			stderr: 'audit: 2 problems found\n'
		});
		expect(onPath).toEqual({
			exitCode: 2,
			invoked: { runtime: 'bun', cli: 'harness', args: audit },
			stderr: ''
		});
		recordExampleCases(
			{
				unitId,
				symbol: 'harness-audit',
				state: 'exits-with-the-audit-failure-code-and-passes-its-output',
				evidence: 'examples-cases',
				file: 'exits-with-the-audit-failure-code-and-passes-its-output.json'
			},
			[
				{
					name: 'the configured CLI reports two problems and exits 1',
					input: given(
						{ HARNESS_CLI_PATH: 'harness-cli.js' },
						{ file: 'harness-cli.js', exitCode: 1, stderr: 'audit: 2 problems found' }
					),
					output: configured
				},
				{
					name: 'the harness on PATH exits 2 and the script exits 2',
					input: given({}, { file: 'bin/harness', exitCode: 2 }),
					output: onPath
				}
			]
		);
	});
});
