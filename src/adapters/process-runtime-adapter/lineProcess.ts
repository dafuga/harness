import { LineProcess, ProcessReply, unavailable, exited } from '../../utils/lineProcess';
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { clearTimeout, setTimeout } from "node:timers";
import { runtimeTimeout } from "../../core/runtimeTypes";

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
