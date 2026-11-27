// @harness-uid u_ucbos7kmyv
import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
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
	options: { input?: string; environment?: Record<string, string>; maxBuffer?: number } = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
	signal.throwIfAborted();
	return new Promise((resolve, reject) => {
		const child = spawn(executable, args, {
			env: { PATH: '/usr/bin:/bin', LANG: 'C', TZ: 'UTC', ...options.environment },
			cwd: '/',
			stdio: 'pipe'
		});
		const limit = options.maxBuffer ?? 4 * 1024 * 1024;
		const stdout = captureHostOutput(child.stdout, limit, interrupt);
		const stderr = captureHostOutput(child.stderr, limit, interrupt);
		let drainDeadline: ReturnType<typeof setTimeout> | undefined;
		let settled = false;
		let exited = false;
		const deadline = setTimeout(interrupt, 30_000);

		function finish(code: number | null) {
			if (settled) return;
			if (code === null) interrupt();
			else {
				cleanup();
				resolve({ code, stdout: stdout(), stderr: stderr() });
			}
		}
		function cleanup() {
			settled = true;
			clearTimeout(deadline);
			clearTimeout(drainDeadline);
			signal.removeEventListener('abort', interrupt);
		}
		function interrupt() {
			if (settled) return;
			cleanup();
			reject(new TrackerHostProcessError('Tracker host command did not complete'));
			if (!exited) child.kill('SIGKILL');
			child.stdin?.destroy();
			child.stdout?.destroy();
			child.stderr?.destroy();
		}

		child.on('error', interrupt);
		child.once('close', finish);
		child.once('exit', (code) => {
			exited = true;
			if (!settled) drainDeadline = drainAfterExit(child, () => finish(code), interrupt);
		});
		signal.addEventListener('abort', interrupt, { once: true });
		child.stdin?.on('error', interrupt);
		if (signal.aborted) interrupt();
		else child.stdin?.end(options.input);
	});
}

// An exit event means the runtime reaped the child. Let its pipes finish if close is missing.
function drainAfterExit(
	{ stdout, stderr }: { stdout: Readable | null; stderr: Readable | null },
	finish: () => void,
	interrupt: () => void
) {
	return setTimeout(() => {
		if (stdout?.readableEnded === false || stderr?.readableEnded === false) interrupt();
		else finish();
	}, 250);
}

function captureHostOutput(stream: Readable | null, limit: number, interrupt: () => void) {
	const chunks: Buffer[] = [];
	let bytes = 0;
	stream?.on('data', (chunk: Buffer) => {
		bytes += chunk.length;
		if (bytes > limit) interrupt();
		else chunks.push(chunk);
	});
	stream?.on('error', interrupt);
	return () => Buffer.concat(chunks, bytes).toString('utf8');
}
