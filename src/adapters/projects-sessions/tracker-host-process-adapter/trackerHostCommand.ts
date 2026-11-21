// @harness-uid u_ucbos7kmyv
import { execFile } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { TrackerHostProcessError } from './TrackerHostProcessError';

export function controlledTrackerExecutable(path: string): string {
	if (!isAbsolute(path)) throw new TypeError('Tracker host driver path must be absolute');
	const executable = realpathSync(path);
	const file = statSync(executable);
	if (
		!file.isFile() ||
		(file.uid !== 0 && file.uid !== process.getuid?.()) ||
		(file.mode & 0o022) !== 0 ||
		(file.mode & 0o100) === 0
	)
		throw new TypeError('Tracker host driver must be an owner-controlled executable');
	return executable;
}

export function runTrackerHostCommand(
	executable: string,
	args: string[],
	signal: AbortSignal,
	options: { input?: string; environment?: Record<string, string> } = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
	signal.throwIfAborted();
	return new Promise((resolve, reject) => {
		const child = execFile(
			executable,
			args,
			{
				env: { PATH: '/usr/bin:/bin', LANG: 'C', TZ: 'UTC', ...options.environment },
				cwd: '/',
				timeout: 30_000,
				maxBuffer: 4 * 1024 * 1024,
				killSignal: 'SIGKILL'
			},
			(error, stdout, stderr) => {
				signal.removeEventListener('abort', interrupt);
				if (signal.aborted || (error && typeof error.code !== 'number'))
					reject(new TrackerHostProcessError('Tracker host command did not complete'));
				else resolve({ stdout, stderr, code: typeof error?.code === 'number' ? error.code : 0 });
			}
		);
		const interrupt = () => child.kill('SIGKILL');
		signal.addEventListener('abort', interrupt, { once: true });
		if (signal.aborted) interrupt();
		child.stdin?.on('error', interrupt);
		child.stdin?.end(options.input);
	});
}
