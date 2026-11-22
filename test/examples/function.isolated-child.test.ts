import { chmod, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import {
	captureIsolatedOutput,
	isolatedChild
} from '../../src/utils/reports-media/run-isolated/isolatedChild';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

type IsolatedRun = Parameters<typeof isolatedChild>[0];
type ChildProcess = ReturnType<typeof isolatedChild>;

const BASE_ENV = { PATH: '/usr/bin:/bin' };
const CAPTURE_BODY = `printf '%s|%s|%s\\n' "$1" "$2" "$3"
printf '%s\\n' "$FIXTURE_MODE"
printf 'stderr-line\\n' >&2`;
const LONG_BODY = "printf 'abcdefghijkl'";
const EXIT_BODY = 'exit 3';

async function writeFake(directory: string, body: string): Promise<string> {
	const file = join(directory, 'fake-cli');
	await writeFile(file, `#!/bin/sh\n${body}\n`);
	await chmod(file, 0o755);
	return file;
}

function makeRun(command: string, cwd: string, extra: Partial<IsolatedRun>): IsolatedRun {
	return {
		command,
		cwd,
		args: [],
		env: BASE_ENV,
		timeoutMs: 20000,
		log: 'run.log',
		maxLogBytes: 1024,
		...extra
	};
}

function waitForClose(child: ChildProcess): Promise<number | null> {
	return new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('close', (code) => resolve(code));
	});
}

async function runCaptured(run: IsolatedRun, limit: number) {
	const child = isolatedChild(run);
	const output: Buffer[] = [];
	captureIsolatedOutput(child, output, limit);
	const code = await waitForClose(child);
	return { code, stdout: Buffer.concat(output).toString('utf8') };
}

test('Captured run passes literal args and merges stderr', async () => {
	await withTempDir('isolated-child-captured-', async (directory) => {
		const command = await writeFake(directory, CAPTURE_BODY);
		const run = makeRun(command, directory, {
			args: ['first arg', '$HOME', '*'],
			env: { ...BASE_ENV, FIXTURE_MODE: 'captured' }
		});
		const result = await runCaptured(run, 1024);
		expect(result).toEqual({ code: 0, stdout: 'first arg|$HOME|*\ncaptured\nstderr-line\n' });
		recordExampleCases(
			{
				unitId: 'function.isolated-child',
				symbol: 'isolatedChild',
				state: 'captured-run-passes-literal-args-and-merges-stderr',
				evidence: 'examples-cases',
				file: 'captured-run-passes-literal-args-and-merges-stderr.json'
			},
			[
				{
					name: 'args with spaces, $HOME and glob stay literal; stderr is merged',
					input: { args: run.args, env: run.env },
					output: result
				}
			]
		);
	});
});

test('Captured output keeps the first limit bytes with a marker', async () => {
	await withTempDir('isolated-child-limit-', async (directory) => {
		const command = await writeFake(directory, LONG_BODY);
		const run = makeRun(command, directory, {});
		const truncated = await runCaptured(run, 5);
		const whole = await runCaptured(run, 64);
		expect(truncated.stdout).toBe('abcde\n[output truncated]\n');
		expect(whole.stdout).toBe('abcdefghijkl');
		recordExampleCases(
			{
				unitId: 'function.isolated-child',
				symbol: 'captureIsolatedOutput',
				state: 'captured-output-keeps-the-first-limit-bytes-with-a-marker',
				evidence: 'examples-cases',
				file: 'captured-output-keeps-the-first-limit-bytes-with-a-marker.json'
			},
			[
				{
					name: 'limit 5 keeps five bytes then the truncation marker',
					input: { limit: 5, stdoutBytes: 12 },
					output: truncated
				},
				{
					name: 'limit 64 keeps all twelve bytes without a marker',
					input: { limit: 64, stdoutBytes: 12 },
					output: whole
				}
			]
		);
	});
});

test('Inherited stdio leaves child streams null and exit code', async () => {
	await withTempDir('isolated-child-inherit-', async (directory) => {
		const command = await writeFake(directory, EXIT_BODY);
		const child = isolatedChild(makeRun(command, directory, { stdio: 'inherit' }));
		const output: Buffer[] = [];
		captureIsolatedOutput(child, output, 1024);
		const streamsNull = [child.stdin, child.stdout, child.stderr].map((stream) => stream === null);
		const code = await waitForClose(child);
		expect(streamsNull).toEqual([true, true, true]);
		expect(output).toEqual([]);
		expect(code).toBe(3);
		recordExampleCases(
			{
				unitId: 'function.isolated-child',
				symbol: 'isolatedChild',
				state: 'inherited-stdio-leaves-child-streams-null-and-exit-code',
				evidence: 'examples-cases',
				file: 'inherited-stdio-leaves-child-streams-null-and-exit-code.json'
			},
			[
				{
					name: 'inherited run exits with its own code and no captured pipes',
					input: { stdio: 'inherit', command: 'fake-cli exits 3' },
					output: { code, streamsNull, outputChunks: output.length }
				}
			]
		);
	});
});

test('Rejects a missing run or args before spawning', () => {
	const noArgs = { ...makeRun('sh', '/', {}), args: undefined as unknown as string[] };
	expect(() => isolatedChild(undefined as unknown as IsolatedRun)).toThrow(TypeError);
	expect(() => isolatedChild(noArgs)).toThrow(TypeError);
	recordExampleCases(
		{
			unitId: 'function.isolated-child',
			symbol: 'isolatedChild',
			state: 'rejects-a-missing-run-or-args-before-spawning',
			evidence: 'examples-cases',
			file: 'rejects-a-missing-run-or-args-before-spawning.json'
		},
		[
			{ name: 'run is undefined', input: { run: 'undefined' }, error: 'TypeError' },
			{ name: 'args is undefined', input: { args: 'undefined' }, error: 'TypeError' }
		]
	);
});
