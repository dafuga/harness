import { afterEach, expect, test } from 'vitest';
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
async function run(scenario: string, cwd: string, targets: string[]) {
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
				timeout: 60000,
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
test.each([
	[
		'catalog-previews',
		{
			scenario: 'catalog-previews',
			file: 'test/utils/recorded-preview.test.ts',
			state: 'preview-safety',
			count: 7,
			workspace: 'desktop'
		}
	],
	[
		'desktop-project-runs',
		{
			scenario: 'desktop-project-runs',
			file: 'test/catalog-listing.test.ts',
			state: 'project-scope',
			count: 6,
			workspace: 'desktop'
		}
	],
	[
		'desktop-project-runs backend boundaries',
		{
			scenario: 'desktop-project-runs',
			file: 'test/backend-boundaries.test.ts',
			state: 'project-scope',
			count: 3,
			workspace: 'desktop'
		}
	],
	[
		'modular-h-branding-contract surfaces',
		{
			scenario: 'modular-h-branding-contract',
			file: 'test/components/brand-mark.test.ts',
			state: 'shared-surfaces',
			count: 6,
			workspace: 'reports'
		}
	],
	[
		'hosted-catalog listing',
		{
			scenario: 'hosted-catalog',
			file: 'test/hub-catalog-listing.test.ts',
			state: 'hosted-detail',
			count: 2,
			workspace: 'hub'
		}
	],
	[
		'remote-desktop-boundaries frame limits',
		{
			scenario: 'remote-desktop-boundaries',
			file: 'test/local-transport-bounds.test.ts',
			state: 'local-authority',
			count: 5,
			workspace: 'desktop'
		}
	],
	[
		'remote-desktop-boundaries socket lifecycle',
		{
			scenario: 'remote-desktop-boundaries',
			file: 'test/local-transport.test.ts',
			state: 'local-socket',
			count: 8,
			workspace: 'desktop'
		}
	],
	[
		'agent-references prompts',
		{
			scenario: 'agent-references',
			file: 'test/run-context-references.test.ts',
			state: 'reference-functions',
			count: 6,
			workspace: 'desktop'
		}
	],
	[
		'agent-references project boundary',
		{
			scenario: 'agent-references',
			file: 'test/services/project-task.test.ts',
			state: 'project-change-boundary',
			count: 1,
			workspace: 'desktop'
		}
	],
	[
		'shells-shared-app routing',
		{
			scenario: 'shells-shared-app',
			file: 'test/shells-category.test.ts',
			state: 'shells-routing',
			count: 6,
			workspace: 'desktop'
		}
	],
	[
		'design-option-storage rules',
		{
			scenario: 'design-option-storage',
			file: 'test/utils/plan-options.test.ts',
			state: 'option-storage',
			count: 13,
			workspace: 'planning'
		}
	]
])(
	'the %s command records every actual test, not just a passing process',
	async (_label, { scenario, file, state, count, workspace }) => {
		const { directory, result } = await run(scenario, join(root, 'packages', workspace), [file]);
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
