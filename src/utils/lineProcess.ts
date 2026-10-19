import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { clearTimeout, setTimeout } from 'node:timers';
import { runtimeFailure, runtimeTimeout, type RuntimeResponse } from '../core/runtimeTypes';

export type ProcessReply = { text: string } | { failure: RuntimeResponse };

export interface LineProcess {
	/** Sends one line and resolves with the next line the process prints. */
	exchange(line: string, timeoutMs: number): Promise<ProcessReply>;
	close(): void;
}

/** Keeps one child process alive and exchanges newline-delimited JSON with it. */
export function lineProcess(command: string, args: string[]): LineProcess {
	let child: ChildProcessWithoutNullStreams | undefined;
	let buffer = '';
	let waiting: ((reply: ProcessReply) => void) | undefined;
	const settle = (reply: ProcessReply) => {
		const resolve = waiting;
		waiting = undefined;
		resolve?.(reply);
	};
	const stop = () => {
		child?.kill('SIGKILL');
		child = undefined;
		buffer = '';
	};
	const ended = (started: ChildProcessWithoutNullStreams, reply: ProcessReply) => {
		if (started !== child) return;
		child = undefined;
		settle(reply);
	};
	const start = () => {
		const started = spawn(command, args, { stdio: 'pipe' });
		child = started;
		started.stdin.on('error', () => undefined);
		started.stdout.on('data', (chunk: Buffer) => {
			buffer += chunk.toString('utf8');
			const end = buffer.indexOf('\n');
			if (end === -1 || started !== child) return;
			const text = buffer.slice(0, end);
			buffer = buffer.slice(end + 1);
			settle({ text });
		});
		started.once('error', (error) => ended(started, { failure: unavailable(command, error) }));
		started.once('close', (code) => ended(started, { failure: exited(code, '') }));
		return started;
	};
	return {
		close: stop,
		exchange: (line, timeoutMs) =>
			new Promise((resolve) => {
				const active = child ?? start();
				const timer = setTimeout(() => {
					stop();
					settle({ failure: runtimeTimeout(timeoutMs) });
				}, timeoutMs);
				waiting = (reply) => {
					clearTimeout(timer);
					resolve(reply);
				};
				active.stdin.write(`${line.replace(/\r?\n/g, ' ')}\n`);
			})
	};
}

export function unavailable(command: string, error: Error): RuntimeResponse {
	return runtimeFailure('runtime-unavailable', `cannot start ${command}: ${error.message}`);
}

export function exited(code: number | null, stderr: string): RuntimeResponse {
	const detail = stderr.trim().slice(-200);
	const message = `process exited with code ${code ?? 'unknown'}${detail ? `: ${detail}` : ''}`;
	return runtimeFailure('runtime-failed', message);
}
