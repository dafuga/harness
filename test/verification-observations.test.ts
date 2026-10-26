import { verificationObservationCases } from './support/verificationObservationCases';
import { afterEach, expect, test } from 'vitest';
import './support/cli-measurement/workloadAssertions';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { captureIndex, type CaptureLine } from '../src/core/verifyTypes';
import { scenarioManifestSchema } from '../src/core/unitTypes';
const root = resolve(import.meta.dirname, '..');
const directories: string[] = [];
afterEach(() => {
	for (const directory of directories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});
async function run(scenario: string, cwd: string, targets: string[], timeout = 60000) {
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
				timeout,
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
function captures(directory: string): CaptureLine[] {
	return readFileSync(join(directory, captureIndex), 'utf8')
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
}
for (const [label, fixture] of verificationObservationCases) {
	const { scenario, file, state, count, workspace } = fixture;
	// Eight socket lifecycles also publish metadata for their real planning commits.
	const timeout = 'timeout' in fixture ? fixture.timeout : 60000;
	test(
		`the ${label} command records every actual test, not just a passing process`,
		async () => {
			const { directory, result } = await run(
				scenario,
				join(root, 'packages', workspace),
				[file],
				timeout
			);
			expect(result.error).toBeUndefined();
			expect(result.status, result.stdout + result.stderr).toBe(0);
			const lines = captures(directory).filter((line) => line.state === state);
			expect(lines.some((line) => line.kind === 'output')).toBe(true);
			const assertion = lines.find((line) => line.kind === 'assertions')!;
			const recorded = JSON.parse(readFileSync(join(directory, assertion.file), 'utf8'));
			expect(recorded.tests).toHaveLength(count);
			for (const entry of recorded.tests) {
				expect(entry.observations.length).toBeGreaterThan(0);
				expect(entry.observations.every((value: { passed: boolean }) => value.passed)).toBe(true);
			}
		},
		timeout
	);
}

test('the Git evidence scenario executes metadata and binary test files and records every required state', async () => {
	const scenario = scenarioManifestSchema.parse(
		JSON.parse(readFileSync(join(root, 'specification/scenarios/git-evidence-read.json'), 'utf8'))
	);
	const all: CaptureLine[] = [];
	for (const check of scenario.tests) {
		const command = check.target.split(/\s+/);
		expect(command.slice(0, 3)).toEqual(['bun', 'test/verification-output.ts', 'vitest']);
		const { directory, result } = await run(scenario.id, root, command.slice(3));
		expect(result.error).toBeUndefined();
		expect(result.status, result.stdout + result.stderr).toBe(0);
		all.push(...captures(directory));
	}
	for (const evidence of scenario.evidence.filter((item) => item.required))
		for (const state of evidence.states)
			expect(
				all.some(
					(line) =>
						line.evidence === evidence.id && line.state === state && line.kind === evidence.kind
				),
				`${evidence.id}:${state}`
			).toBe(true);
}, 60000);

test('an extra test target is rejected before any runner starts or evidence is recorded', async () => {
	const { directory, result } = await run('git-evidence-read', root, [
		'test/evidence-batch.test.ts',
		'test/utils/read-tree-texts.test.ts'
	]);
	expect(result.status).not.toBe(0);
	expect(result.stderr).toContain('Expected exactly one runner and test file');
	expect(() => captures(directory)).toThrow(/ENOENT/);
}, 60000);
