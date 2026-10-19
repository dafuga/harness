import { afterEach, expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
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
function run(scenario: string, cwd: string, targets: string[]) {
	const directory = mkdtempSync(join(tmpdir(), 'harness-observation-proof-'));
	directories.push(directory);
	const result = spawnSync(
		'bun',
		[join(root, 'test/verification-output.ts'), 'vitest', ...targets],
		{
			cwd,
			encoding: 'utf8',
			timeout: 60000,
			maxBuffer: 8_000_000,
			env: {
				...process.env,
				HARNESS_SCENARIO: scenario,
				HARNESS_EVIDENCE_DIR: directory,
				TAKE_SCREENSHOT: '1'
			}
		}
	);
	return { directory, result };
}
function captures(directory: string): CaptureLine[] {
	return readFileSync(join(directory, captureIndex), 'utf8')
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
}
test.each([
	['catalog-previews', 'test/utils/recorded-preview.test.ts', 'preview-safety', 7],
	['desktop-project-runs', 'test/catalog-listing.test.ts', 'project-scope', 6]
])(
	'the %s command records every actual test, not just a passing process',
	(scenario, file, state, count) => {
		const { directory, result } = run(scenario, join(root, 'packages/desktop'), [file]);
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
	60000
);

test('the Git evidence scenario executes metadata and binary test files and records every required state', () => {
	const scenario = scenarioManifestSchema.parse(
		JSON.parse(readFileSync(join(root, 'specification/scenarios/git-evidence-read.json'), 'utf8'))
	);
	const all: CaptureLine[] = [];
	for (const check of scenario.tests) {
		const command = check.target.split(/\s+/);
		expect(command.slice(0, 3)).toEqual(['bun', 'test/verification-output.ts', 'vitest']);
		const { directory, result } = run(scenario.id, root, command.slice(3));
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

test('an extra test target is rejected before any runner starts or evidence is recorded', () => {
	const { directory, result } = run('git-evidence-read', root, [
		'test/evidence-batch.test.ts',
		'test/utils/read-tree-texts.test.ts'
	]);
	expect(result.status).not.toBe(0);
	expect(result.stderr).toContain('Expected exactly one runner and test file');
	expect(() => captures(directory)).toThrow(/ENOENT/);
}, 60000);
