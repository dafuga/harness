import { execFile } from 'node:child_process';

/** Child output can contain credentials or test data. Keep it private to the calling script. */
export async function deliveryProcess(command: string[], env?: Record<string, string>) {
	const [program, ...args] = command;
	return new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
		execFile(program, args, { env, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
			const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
			resolve({ stdout, stderr, code });
		});
	});
}
