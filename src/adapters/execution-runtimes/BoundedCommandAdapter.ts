// @harness-uid u_34r2rrehaa
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { BoundedCommandOptions, BoundedCommandResult } from './BoundedCommandAdapter.types';

/** Explicit child environment; callers may supply task-specific keys deliberately. */
export function commandEnvironment(
	extra: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
	const result: Record<string, string | undefined> = {};
	for (const key of [
		'PATH',
		'HOME',
		'USER',
		'LOGNAME',
		'SHELL',
		'TMPDIR',
		'TEMP',
		'TMP',
		'LANG',
		'LC_ALL',
		'TZ',
		'SYSTEMROOT'
	])
		if (process.env[key] !== undefined) result[key] = process.env[key];
	return { ...result, ...extra };
}
function killGroup(child: ChildProcessWithoutNullStreams): void {
	if (!child.pid) return;
	try {
		process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL');
	} catch {
		/* The owned process may already have exited. */
	}
}
function limits(options: BoundedCommandOptions) {
	const timeout = options.timeoutMs ?? 60000;
	const maxBuffer = options.maxBuffer ?? 8 * 1024 * 1024;
	if (
		![timeout, maxBuffer].every(
			(value) => Number.isSafeInteger(value) && value > 0 && value <= 2147483647
		)
	)
		throw new Error('Command bounds must be positive finite integers.');
	return { timeout, maxBuffer };
}
function collect(
	child: ChildProcessWithoutNullStreams,
	options: BoundedCommandOptions
): Promise<BoundedCommandResult> {
	const { timeout, maxBuffer } = limits(options);
	return new Promise((resolve, reject) => {
		const output = { stdout: [] as Buffer[], stderr: [] as Buffer[] };
		let bytes = 0;
		let failure: unknown;
		const stop = (reason: unknown) => {
			failure ??= reason;
			killGroup(child);
		};
		const timer = setTimeout(() => stop(new Error('Command timed out.')), timeout);
		const abort = () => stop(options.signal?.reason ?? new Error('Command aborted.'));
		options.signal?.addEventListener('abort', abort, { once: true });
		for (const stream of ['stdout', 'stderr'] as const) {
			child[stream].on('data', (chunk: Buffer) => {
				bytes += chunk.length;
				if (bytes > maxBuffer) stop(new Error('Command output limit exceeded.'));
				else output[stream].push(chunk);
			});
		}
		child.once('error', (error) => {
			failure ??= error;
		});
		child.once('exit', () => killGroup(child));
		child.once('close', (code) => {
			clearTimeout(timer);
			options.signal?.removeEventListener('abort', abort);
			if (failure) reject(failure);
			else
				resolve({
					code: code ?? 1,
					stdout: Buffer.concat(output.stdout),
					stderr: Buffer.concat(output.stderr).toString('utf8')
				});
		});
		child.stdin.on('error', () => undefined);
		child.stdin.end(options.input);
		if (options.signal?.aborted) abort();
	});
}
/** Runs a directly named executable, with a deadline and combined output bound. */
export class BoundedCommandAdapter {
	async checked(
		command: string,
		args: string[] = [],
		options: BoundedCommandOptions = {}
	): Promise<Buffer> {
		const result = await this.run(command, args, options);
		if (result.code !== 0) throw new Error(`Command failed with exit code ${result.code}.`);
		return result.stdout;
	}

	run(
		command: string,
		args: string[] = [],
		options: BoundedCommandOptions = {}
	): Promise<BoundedCommandResult> {
		limits(options);
		options.signal?.throwIfAborted();
		const child = spawn(command, args, {
			cwd: options.cwd,
			env: commandEnvironment(options.env),
			stdio: 'pipe',
			detached: process.platform !== 'win32'
		});
		const result = collect(child, options);
		options.onSpawn?.(child);
		return result;
	}
	runSync(
		command: string,
		args: string[] = [],
		options: BoundedCommandOptions = {}
	): BoundedCommandResult {
		const { timeout, maxBuffer } = limits(options);
		const result = spawnSync(command, args, {
			cwd: options.cwd,
			env: commandEnvironment(options.env),
			input: options.input,
			timeout,
			maxBuffer,
			killSignal: 'SIGKILL',
			signal: options.signal
		});
		if (result.error) throw result.error;
		return {
			code: result.status ?? 1,
			stdout: result.stdout ?? Buffer.alloc(0),
			stderr: result.stderr?.toString('utf8') ?? ''
		};
	}
}
export type { BoundedCommandOptions, BoundedCommandResult } from './BoundedCommandAdapter.types';
