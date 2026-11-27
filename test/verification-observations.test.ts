import { afterEach, expect, test } from 'vitest';
import './support/cli-measurement/workloadAssertions';
import { readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { CaptureLine } from '../src/core/verifyTypes';
import { captureLines } from './utils/verification-observations/captureLines';
import { scenarioManifestSchema } from '../src/core/unitTypes';
import { observationTimeout, runVerificationObservation } from './support/verificationObservation';

const root = resolve(import.meta.dirname, '..');
const directories: string[] = [];
afterEach(() => {
	for (const directory of directories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});
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
			count: 4,
			workspace: 'desktop'
		}
	],
	[
		'modular-h-branding-contract surfaces',
		{
			scenario: 'modular-h-branding-contract',
			file: 'test/components/brand-mark.test.ts',
			state: 'shared-surfaces',
			count: 5,
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
		const { directory, result } = await runVerificationObservation(
			scenario,
			join(root, 'packages', workspace),
			[file],
			directories
		);
		expect(result.error).toBeUndefined();
		expect(result.status, result.stdout + result.stderr).toBe(0);
		const lines = captureLines(directory).filter((line) => line.state === state);
		expect(lines.some((line) => line.kind === 'output')).toBe(true);
		const assertion = lines.find((line) => line.kind === 'assertions')!;
		const recorded = JSON.parse(readFileSync(join(directory, assertion.file), 'utf8'));
		expect(recorded.tests).toHaveLength(count);
		for (const entry of recorded.tests) {
			expect(entry.observations.length).toBeGreaterThan(0);
			expect(entry.observations.every((value: { passed: boolean }) => value.passed)).toBe(true);
		}
	},
	observationTimeout
);
test(
	'headless scenario commands record every actual test and required evidence state',
	async () => {
		for (const id of [
			'git-evidence-read',
			'upload-request-admission',
			'tracker-phone-replica',
			'unit-registry-ownership'
		]) {
			const scenario = scenarioManifestSchema.parse(
				JSON.parse(readFileSync(join(root, 'specification/scenarios', id + '.json'), 'utf8'))
			);
			const all: CaptureLine[] = [];
			for (const check of scenario.tests) {
				const command = check.target.split(/\s+/);
				const cwd = resolve(root, check.cwd ?? '.');
				expect([command[0], command[2]]).toEqual(['bun', 'vitest']);
				expect(resolve(cwd, command[1])).toBe(join(root, 'test/verification-output.ts'));
				const { directory, result } = await runVerificationObservation(
					scenario.id,
					cwd,
					command.slice(3),
					directories
				);
				expect(result.error).toBeUndefined();
				expect(result.status, result.stdout + result.stderr).toBe(0);
				all.push(...captureLines(directory));
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
		}
	},
	observationTimeout
);

test('an extra test target is rejected before any runner starts or evidence is recorded', async () => {
	const { directory, result } = await runVerificationObservation(
		'git-evidence-read',
		root,
		['test/evidence-batch.test.ts', 'test/utils/read-tree-texts.test.ts'],
		directories
	);
	expect(result.status).not.toBe(0);
	expect(result.stderr).toContain('Expected exactly one runner and test file');
	expect(() => captureLines(directory)).toThrow(/ENOENT/);
}, 60000);
