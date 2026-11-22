import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Each case runs a whole Vitest process.
export const observationTimeout = 180_000;
const root = resolve(import.meta.dirname, '../..');

export async function runVerificationObservation(
	scenario: string,
	cwd: string,
	targets: string[],
	directories: string[]
) {
	const directory = mkdtempSync(join(tmpdir(), 'harness-observation-proof-'));
	directories.push(directory);
	// Yield while commands run so Vitest can acknowledge its worker's reporting messages.
	const result = await new Promise<{
		error: Error | undefined;
		status: number | null;
		stdout: string;
		stderr: string;
	}>((resolveResult) =>
		execFile(
			'bun',
			[join(root, 'test/verification-output.ts'), 'vitest', ...targets],
			{
				cwd,
				encoding: 'utf8',
				timeout: observationTimeout,
				maxBuffer: 8_000_000,
				env: {
					...process.env,
					HARNESS_SCENARIO: scenario,
					HARNESS_EVIDENCE_DIR: directory,
					TAKE_SCREENSHOT: '1'
				}
			},
			(error, stdout, stderr) =>
				resolveResult({
					error: error && typeof error.code !== 'number' ? error : undefined,
					status: error ? Number(error.code) || null : 0,
					stdout,
					stderr
				})
		)
	);
	return { directory, result };
}
