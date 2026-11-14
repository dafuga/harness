// @harness-uid u_34r2rrehaa
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { basename } from 'node:path';
import type { BoundedCommandOptions, BoundedCommandResult } from './BoundedCommandAdapter.types';
import { commandDeadlines } from './bounded-command-adapter/commandDeadlines';
import { timeoutFailure, commandLabel } from './bounded-command-adapter/commandFailure';

const owned = new Set<ChildProcessWithoutNullStreams>();
const signalHandlers = new Map<NodeJS.Signals, () => void>();

function registerForSignals(child: ChildProcessWithoutNullStreams): () => void {
	if (process.platform === 'win32') return () => undefined;
	owned.add(child);
	for (const signal of ['SIGINT', 'SIGTERM'] as const) {
		if (signalHandlers.has(signal)) continue;
		const handler = () => {
			for (const running of owned) killGroup(running);
			process.removeListener(signal, handler);
			signalHandlers.delete(signal);
			process.kill(process.pid, signal);
		};
		signalHandlers.set(signal, handler);
		process.on(signal, handler);
	}
	return () => {
		owned.delete(child);
		if (owned.size) return;
		for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
		signalHandlers.clear();
	};
}

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
		'SYSTEMROOT',
		'CI',
		'NODE_OPTIONS',
		'NODE_PATH',
		'GH_TOKEN',
		'SSL_CERT_FILE',
		'SSL_CERT_DIR',
		'HTTP_PROXY',
		'HTTPS_PROXY',
		'ALL_PROXY',
		'NO_PROXY',
		'http_proxy',
		'https_proxy',
		'all_proxy',
		'no_proxy',
		'XDG_CONFIG_HOME'
	])
		if (process.env[key] !== undefined) result[key] = process.env[key];
	for (const [key, value] of Object.entries(process.env))
		if (key.startsWith('PROJECT_REPORTS_R2_') && value !== undefined) result[key] = value;
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
	const timeout = options.timeoutMs ?? commandDeadlines.backstopMs;
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
		const timer = setTimeout(
			() => stop(timeoutFailure(commandLabel(child.spawnfile), timeout)),
			timeout
		);
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
			unregister();
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
		const unregister = registerForSignals(child);
		child.stdin.end(options.input);
		if (options.signal?.aborted) abort();
	});
}

function isDirectProbe(command: string, args: string[]): boolean {
	const executable = basename(command);
	if (executable === 'ps') return true;
	if (executable === 'xcode-select') return args.length === 1 && args[0] === '-p';
	if (executable !== 'git') return false;
	const tail = args[0] === '-C' ? args.slice(2) : args;
	if (['--version', 'rev-parse', 'check-ignore'].includes(tail[0])) return true;
	return (
		tail[0] === 'remote' && (tail.length === 1 || (tail[1] === 'get-url' && tail.length === 3))
	);
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
		if (!isDirectProbe(command, args))
			throw new Error(
				'Synchronous execution is restricted to direct probes; use run for workloads.'
			);
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
export { commandDeadlines } from './bounded-command-adapter/commandDeadlines';
