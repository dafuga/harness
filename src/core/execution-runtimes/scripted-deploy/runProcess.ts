// @harness-uid u_b5ysx34qie
import type { RunProcessOptions } from './runProcess.types';
import { execFile, type ExecFileOptions } from 'node:child_process';

export function runProcess(
	file: string,
	args: string[],
	options: RunProcessOptions
): Promise<string> {
	const config: ExecFileOptions = {
		encoding: 'utf8',
		cwd: options.cwd,
		timeout: options.timeout ?? 30_000,
		maxBuffer: 1024 * 1024,
		killSignal: 'SIGKILL',
		signal: options.signal,
		env: { PATH: process.env.PATH, HOME: process.env.HOME, GIT_TERMINAL_PROMPT: '0', NO_COLOR: '1' }
	};
	return new Promise((resolve, reject) => {
		const child = execFile(file, args, config, (error, stdout) => {
			if (error)
				reject(
					new Error(
						options.description +
							' failed (exit ' +
							(error.code ?? error.signal ?? 'unknown') +
							').'
					)
				);
			else resolve(stdout.toString());
		});
		child.stdin?.on('error', () => {});
		child.stdin?.end(
			options.stdin === undefined ? undefined : JSON.stringify(options.stdin) + '\n'
		);
	});
}
