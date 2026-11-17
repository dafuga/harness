import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { moduleCategoryFindings } from '../../src/audit/development-tooling/structure-rules/moduleCategoryFindings';
import { auditHarnessStructure } from '../../src/audit/development-tooling/structure-rules/structureRules';

const emptySnapshot = { profile: 'lib' as const, files: [], dirs: [] };
const srcOnlySnapshot = { profile: 'lib' as const, files: [], dirs: ['src'] };
const legacyFile = 'src/utils/old.ts';
const groupsConfig = {
	schemaVersion: 1,
	groups: [{ id: 'audit', title: 'Audit' }],
	legacy: [legacyFile]
};

function record(
	symbol: string,
	state: string,
	cases: Array<{ name: string; input: unknown; output: unknown }>
): void {
	recordExampleCases(
		{
			unitId: 'audit.structure-rules',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

function thrownCode(run: () => unknown): string {
	try {
		run();
	} catch (error) {
		return (error as { code?: string }).code ?? 'unknown';
	}
	return 'none';
}

test('Reports a folder name that is not kebab-case', () => {
	const input = { profile: 'lib' as const, files: [], dirs: ['src', 'src/BadFolder'] };
	const output = auditHarnessStructure(input);
	expect(output).toContainEqual({
		path: 'src/BadFolder',
		rule: 'folder-name-pattern',
		message: 'Folder "BadFolder" should use lowercase kebab-case or a SvelteKit route segment.'
	});
	record('auditHarnessStructure', 'reports-a-folder-name-that-is-not-kebab-case', [
		{ name: 'PascalCase src folder', input, output }
	]);
});

test('Returns no findings for an empty snapshot', () => {
	const emptyOutput = auditHarnessStructure(emptySnapshot);
	const srcOutput = auditHarnessStructure(srcOnlySnapshot);
	expect(emptyOutput).toEqual([]);
	expect(srcOutput).toEqual([]);
	record('auditHarnessStructure', 'returns-no-findings-for-an-empty-snapshot', [
		{ name: 'empty lib snapshot', input: emptySnapshot, output: emptyOutput },
		{ name: 'lib snapshot with only src', input: srcOnlySnapshot, output: srcOutput }
	]);
});

test('Reports no module category finding without a config', async () => {
	const files = ['src/audit/thing.ts'];
	const output = await withTempDir('structure-rules-', (root) =>
		moduleCategoryFindings({ root, profile: 'app', files, dirs: ['src'] })
	);
	expect(output).toEqual([]);
	record('moduleCategoryFindings', 'reports-no-module-category-finding-without-a-config', [
		{
			name: 'temporary project with no module config',
			input: { root: 'temporary project', files, dirs: ['src'] },
			output
		}
	]);
});

test('Throws Error when a legacy entry source file is missing', async () => {
	const input = { legacy: groupsConfig.legacy, files: [legacyFile], sourceExists: false };
	await withTempDir('structure-rules-error-', (root) => {
		writeFileSync(join(root, 'harness.groups.json'), JSON.stringify(groupsConfig));
		const run = () =>
			moduleCategoryFindings({ root, profile: 'app', files: [legacyFile], dirs: ['src'] });
		expect(run).toThrow(/ENOENT/);
		const code = thrownCode(run);
		expect(code).toBe('ENOENT');
		recordExampleCases(
			{
				unitId: 'audit.structure-rules',
				symbol: 'moduleCategoryFindings',
				state: 'throws-error-when-a-legacy-entry-source-file-is-missing',
				evidence: 'examples-cases',
				file: 'throws-error-when-a-legacy-entry-source-file-is-missing.json'
			},
			[{ name: 'legacy entry whose source file is absent', input, error: code }]
		);
	});
});
