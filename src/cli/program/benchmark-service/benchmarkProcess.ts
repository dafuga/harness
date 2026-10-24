import type { BenchmarkProcessInput, BenchmarkProcessResult } from './benchmarkProcess.types';
export type { BenchmarkProcessInput, BenchmarkProcessResult } from './benchmarkProcess.types';
import { spawn } from 'node:child_process';
export function benchmarkEnvironment(): Record<string, string | undefined> {
	const env: Record<string, string | undefined> = { HARNESS_ANALYTICS_DISABLED: '1' };
	for (const key of [
		'PATH',
		'HOME',
		'USER',
		'LOGNAME',
		'SHELL',
		'TMPDIR',
		'TEMP',
		'LANG',
		'TZ',
		'SYSTEMROOT'
	])
		if (process.env[key]) env[key] = process.env[key];
	return env;
}
export function benchmarkProcess(input: BenchmarkProcessInput): Promise<BenchmarkProcessResult> {
	input.signal?.throwIfAborted();
	return new Promise((resolve, reject) => {
		const child = spawn(input.command[0], input.command.slice(1), {
			cwd: input.cwd,
			env: benchmarkEnvironment(),
			stdio: 'pipe',
			detached: process.platform !== 'win32'
		});
		const output = { stdout: '', stderr: '' };
		let overflow = false;
		const kill = () => killBenchmarkProcess(child.pid);
		input.signal?.addEventListener('abort', kill, { once: true });
		for (const stream of ['stdout', 'stderr'] as const) {
			child[stream].on('data', (chunk: Buffer) => {
				output[stream] += chunk.toString();
				if (output[stream].length > 8_000_000) {
					overflow = true;
					kill();
				}
			});
		}
		child.once('error', reject);
		child.once('exit', kill);
		child.once('close', (code) => {
			input.signal?.removeEventListener('abort', kill);
			if (input.signal?.aborted) reject(input.signal.reason);
			else if (overflow) reject(new Error('Benchmark process output exceeded its limit.'));
			else resolve({ exitCode: code ?? 1, ...output });
		});
		child.stdin.on('error', () => {});
		child.stdin.end(input.input);
	});
}
function killBenchmarkProcess(pid: number | undefined): void {
	if (!pid) return;
	try {
		process.kill(process.platform === 'win32' ? pid : -pid, 'SIGKILL');
	} catch {
		/* The process may already have exited. */
	}
}
