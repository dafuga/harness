import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { moduleCategoryFindings } from '../../src/audit/development-tooling/structure-rules/moduleCategoryFindings';
import { auditHarnessStructure } from '../../src/audit/development-tooling/structure-rules/structureRules';

const emptySnapshot = { profile: 'lib' as const, files: [], dirs: [] };
const srcOnlySnapshot = { profile: 'lib' as const, files: [], dirs: ['src'] };

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

test('Reports a folder name that is not kebab-case', () => {
	const input = { profile: 'lib' as const, files: [], dirs: ['src', 'src/BadFolder'] };
	const output = auditHarnessStructure(input);
	expect(output).toContainEqual({
		path: 'src/BadFolder',
		rule: 'folder-name-pattern',
		message:
			'Folder "BadFolder" should use lowercase kebab-case or a SvelteKit route segment.'
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
