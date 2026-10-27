import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect } from 'vitest';

/** A real mapped scenario must retain the exact runner case and tested revision. */
export async function assertScenarioCaseResults(): Promise<void> {
	const root = resolve(import.meta.dirname, '../../..');
	const directory = mkdtempSync(join(tmpdir(), 'harness-scenario-case-'));
	const revision = process.env.HARNESS_VERIFY_REVISION ?? 'c'.repeat(40);
	try {
		const output = await new Promise<{ error: Error | null; stdout: string; stderr: string }>(
			(done) => {
				execFile(
					'bun',
					[join(root, 'test/verification-output.ts'), 'vitest', 'test/utils/plan-data.test.ts'],
					{
						cwd: join(root, 'packages/planning'),
						encoding: 'utf8',
						timeout: 60000,
						maxBuffer: 8_000_000,
						env: {
							...process.env,
							HARNESS_SCENARIO: 'planning-artifacts',
							HARNESS_EVIDENCE_DIR: directory,
							HARNESS_VERIFY_CASE_ROOT: root,
							HARNESS_VERIFY_REVISION: revision
						}
					},
					(error, stdout, stderr) => done({ error, stdout, stderr })
				);
			}
		);
		expect(output.error, output.stdout + output.stderr).toBeNull();
		const path = join(directory, 'case-results.ndjson');
		expect(existsSync(path), 'Scenario runner must record revision-bound case outcomes').toBe(true);
		const rows = readFileSync(path, 'utf8')
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
		expect(rows).toEqual([
			{
				file: 'packages/planning/test/utils/plan-data.test.ts',
				title: 'canonical data ignores object insertion order but preserves array order',
				revision,
				retry: 0,
				status: 'passed'
			}
		]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}
