// @harness-uid u_34r2rrehaa
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { basename } from 'node:path';
import type { BoundedCommandOptions, BoundedCommandResult } from './BoundedCommandAdapter.types';
import { commandDeadlines } from './bounded-command-adapter/commandDeadlines';
import {
	BoundedCommandFailure,
	commandLabel,
	timeoutFailure
} from './bounded-command-adapter/commandFailure';
import { commandEnvironment } from './bounded-command-adapter/commandEnvironment';
import { commandOutput } from './bounded-command-adapter/commandOutput';

const owned = new Set<ChildProcessWithoutNullStreams>();
const signalHandlers = new Map<'SIGINT' | 'SIGTERM', () => void>();

function registerForSignals(child: ChildProcessWithoutNullStreams): () => void {
	if (process.platform === 'win32') return () => undefined;
	owned.add(child);
	for (const signal of ['SIGINT', 'SIGTERM'] as const) {
		// Bun can restore the default signal action when a second listener is removed.
		if (process.listenerCount(signal) > 0) continue;
		const handler = () => {
			// A caller with its own handler must be able to finish its shutdown.
			if (process.listenerCount(signal) > 1) return;
			for (const running of owned) killGroup(running);
			process.removeListener(signal, handler);
			signalHandlers.delete(signal);
			process.kill(process.pid, signal);
		};
		signalHandlers.set(signal, handler);
		process.prependListener(signal, handler);
	}
	return () => {
		owned.delete(child);
		if (owned.size) return;
		for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
		signalHandlers.clear();
	};
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
		const output = commandOutput(maxBuffer);
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
				if (!output.append(stream, chunk)) stop(new Error('Command output limit exceeded.'));
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
			const captured = output.read();
			if (failure)
				reject(
					new BoundedCommandFailure(
						failure instanceof Error ? failure.message : 'Command failed.',
						captured.stdout,
						captured.stderr
					)
				);
			else resolve({ code: code ?? 1, ...captured });
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
		if (result.code !== 0)
			throw new BoundedCommandFailure(
				`Command failed with exit code ${result.code}.`,
				result.stdout,
				result.stderr
			);
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
		const { timeout, maxBuffer } = limits({
			...options,
			timeoutMs: options.timeoutMs ?? commandDeadlines.syncProbeMs
		});
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
export { commandEnvironment } from './bounded-command-adapter/commandEnvironment';
