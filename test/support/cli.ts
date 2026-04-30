import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cliPath = join(repoRoot, 'src/index.ts');

export interface CommandResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

export async function runHarness(
	args: string[],
	cwd: string,
	expectSuccess = true
): Promise<CommandResult> {
	return runCommand(['bun', cliPath, ...args], cwd, expectSuccess);
}

export async function runCommand(
	args: string[],
	cwd: string,
	expectSuccess = true
): Promise<CommandResult> {
	const child = spawn(args[0], args.slice(1), {
		cwd,
		env: { ...process.env, HARNESS_CLI_PATH: cliPath },
		stdio: 'pipe'
	});
	const stdoutChunks: Buffer[] = [];
	const stderrChunks: Buffer[] = [];

	child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
	child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

	const exitCode = await new Promise<number>((resolveExit) => {
		child.once('exit', (code) => resolveExit(code ?? 1));
	});
	const stdout = Buffer.concat(stdoutChunks).toString('utf8');
	const stderr = Buffer.concat(stderrChunks).toString('utf8');

	if (expectSuccess && exitCode !== 0) {
		throw new Error(`${args.join(' ')} failed with ${exitCode}\n${stdout}\n${stderr}`);
	}

	return { exitCode, stdout, stderr };
}

export function commandOutput(result: CommandResult): string {
	return `${result.stdout}\n${result.stderr}`;
}
