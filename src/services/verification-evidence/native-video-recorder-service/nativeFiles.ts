// @harness-uid u_akqk4uwm6b
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { ExpectedCliError } from '../../../core/development-tooling/errors';

export function recordingHash(bytes: Buffer | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}
export function recordingFailure(message: string): never {
	throw new ExpectedCliError(message);
}
export function recordingFile(path: string, maximum: number): Buffer {
	const stat = lstatSync(path);
	if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximum || stat.size <= 0)
		recordingFailure('recording cache file exceeds admission or is not a regular file');
	return readFileSync(path);
}
export function recordingChild(program: string, args: string[], cwd: string): Buffer {
	const result = spawnSync(program, args, {
		cwd,
		timeout: 30_000,
		maxBuffer: 1_000_000,
		stdio: ['ignore', 'pipe', 'pipe']
	});
	if (result.error || result.status !== 0)
		recordingFailure(
			`${program} failed during native video encoding: ${result.stderr?.toString().slice(-1500) ?? result.error?.message}`
		);
	return result.stdout;
}
export function recordingViewport(viewport: { width: number; height: number }): void {
	const { width, height } = viewport;
	if (
		![width, height].every((n) => Number.isInteger(n) && n > 0 && n <= 1920 && n % 2 === 0) ||
		width * height > 2_073_600
	)
		recordingFailure(
			'native recording viewport must have even dimensions within 1920 and 2 megapixels'
		);
}

export function recordingFlags(flags: string[] = []): string[] {
	if (flags.length > 256 || flags.some((id) => !id.trim() || id.length > 200))
		recordingFailure('invalid native recording addressed flags');
	return [...new Set(flags)].sort();
}
