import type { ProcessOptions } from './cliProcess.types';
export type { ProcessOptions } from './cliProcess.types';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { resourceEnvironment } from '../../../../../src/utils/execution-runtimes/resourceEnvironment';
import type { CliCommand } from '../../models/agents-providers/AgentRunner.types';
import { RunCancelled } from '../../models/agents-providers/AgentRunner.types';
import { cliEnvironment } from './cli-environment/cliEnvironment';
import { streamLines } from './streamLines';
export function killOwnedProcess(pid: number | undefined): void {
	if (!pid) return;
	try {
		process.kill(process.platform === 'win32' ? pid : -pid, 'SIGTERM');
	} catch {
		/* Already exited. */
	}
}
function processFor(command: CliCommand, options: ProcessOptions) {
	return spawn(command.command, command.args, {
		cwd: options.cwd,
		env: { ...cliEnvironment(), ...resourceEnvironment(options.resources?.env ?? {}) },
		detached: process.platform !== 'win32',
		stdio: 'pipe'
	});
}
export async function cliProcess(
	command: CliCommand,
	options: ProcessOptions = {}
): Promise<string> {
	if (options.signal?.aborted) throw new RunCancelled();
	return new Promise((resolve, reject) => {
		const child = processFor(command, options),
			decoder = new StringDecoder('utf8');
		let output = '',
			error = '',
			settled = false;
		const finish = (failure: Error | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			options.signal?.removeEventListener('abort', cancel);
			if (failure) reject(failure);
			else resolve(output);
		};
		const cancel = () => {
			killOwnedProcess(child.pid);
			finish(new RunCancelled());
		};
		const timer = setTimeout(() => {
			killOwnedProcess(child.pid);
			finish(new Error('CLI request timed out.'));
		}, options.timeoutMs ?? 600000);
		options.signal?.addEventListener('abort', cancel, { once: true });
		child.on('error', finish);
		const consume = streamLines({
			onLine: (line) => options.onLine?.(line),
			maxBytes: options.maxBytes ?? 16000000,
			onOverflow: () => finish(new Error('CLI output exceeded its limit.'))
		});
		child.stdout.on('data', (chunk: Buffer) => {
			output += decoder.write(chunk);
			if (Buffer.byteLength(output) > (options.maxBytes ?? 16000000)) {
				killOwnedProcess(child.pid);
				finish(new Error('CLI output exceeded its limit.'));
				return;
			}
			consume.write(chunk);
		});
		child.stderr.on('data', (chunk: Buffer) => {
			error = (error + chunk.toString()).slice(-2000);
		});
		child.on('close', (code) => {
			output += decoder.end();
			consume.end();
			finish(code === 0 ? null : new Error('CLI failed (' + String(code) + '): ' + error));
		});
		closeInput(child, options.input ?? '', finish);
		if (child.pid) options.resources?.track(child.pid);
	});
}

function closeInput(
	child: ChildProcessWithoutNullStreams,
	input: string,
	finish: (failure: Error | null) => void
): void {
	child.stdin.on('error', (error: NodeJS.ErrnoException) => {
		if (error.code !== 'EPIPE') finish(error);
	});
	child.stdin.end(input);
}
