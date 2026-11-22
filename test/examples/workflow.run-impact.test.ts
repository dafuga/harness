import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import {
	renderImpact,
	runImpact,
	runtimeKind
} from '../../src/workflows/development-tooling/runImpact';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Reports an added source file from an empty base', async () => {
	await withTempRepo(async ({ root }) => {
		mkdirSync(join(root, 'src'), { recursive: true });
		writeFileSync(join(root, 'src/feature.ts'), 'export const feature = "ready";\n');
		const report = await runImpact({ root, base: 'none', runtime: 'module' });

		expect(report).toMatchObject({ base: 'none', head: 'working-tree', runtime: 'module' });
		expect(report.changed.map(({ path }) => path)).toEqual(['src/feature.ts']);
		recordExampleCases(
			{
				unitId: 'workflow.run-impact',
				symbol: 'runImpact',
				state: 'reports-an-added-source-file-from-an-empty-base',
				evidence: 'examples-cases',
				file: 'reports-an-added-source-file-from-an-empty-base.json'
			},
			[
				{
					name: 'Compares a new source file with the empty starting point',
					input: {
						root: '<temporary Git repository>',
						base: 'none',
						runtime: 'module',
						sourceFile: 'src/feature.ts'
					},
					output: report
				}
			]
		);
	});
});

test('Accepts exact runtime names and rejects altered names', () => {
	const accepted = ['default', 'process', 'http'].map((value) => ({
		value,
		output: runtimeKind(value)
	}));
	let rejected: unknown;
	try {
		runtimeKind('Process');
	} catch (error) {
		rejected = error;
	}
	expect(accepted.map(({ output }) => output)).toEqual(['default', 'process', 'http']);
	expect(rejected).toMatchObject({
		name: 'ExpectedCliError',
		message: 'Unknown runtime "Process". Use one of: default, module, wasm, process, http.'
	});
	const error = rejected as Error;
	recordExampleCases(
		{
			unitId: 'workflow.run-impact',
			symbol: 'runtimeKind',
			state: 'accepts-exact-runtime-names-and-rejects-altered-names',
			evidence: 'examples-cases',
			file: 'accepts-exact-runtime-names-and-rejects-altered-names.json'
		},
		[
			...accepted.map(({ value, output }) => ({
				name: `Accepts ${value} as an exact runtime name`,
				input: { value },
				output
			})),
			{
				name: 'Rejects a runtime name with altered case',
				input: { value: 'Process' },
				error: { name: error.name, message: error.message }
			}
		]
	);
});

const standard: Parameters<typeof renderImpact>[0] = {
	base: '6c1f0a4e9b2d7837f5a1c0e8d4b93a2f71e50d86',
	head: 'working-tree',
	runtime: 'module',
	expanded: false,
	changed: [
		{
			path: 'src/workflows/development-tooling/runImpact.ts',
			status: 'modified',
			classification: 'source',
			unit: 'workflow.run-impact'
		}
	],
	units: { direct: ['workflow.run-impact'], indirect: [], added: [], removed: [] },
	tests: {
		selected: ['test/verify-range.e2e.test.ts'],
		excluded: ['test/services/kernel-parity.test.ts', 'test/utils/impact-kernel.test.ts'],
		removed: []
	},
	scenarios: { affected: [], unaffected: [] },
	uncertain: []
};
const widened: Parameters<typeof renderImpact>[0] = {
	base: '3f9c2a1b7d4e5f60718293a4b5c6d7e8f9012345',
	head: '9a8b7c6d5e4f30211a2b3c4d5e6f708192a3b4c5',
	runtime: 'process',
	expanded: true,
	changed: [
		{
			path: 'src/workflows/development-tooling/runImpact.types.ts',
			status: 'modified',
			classification: 'source',
			unit: 'workflow.run-impact'
		}
	],
	units: { direct: ['workflow.run-impact'], indirect: [], added: [], removed: [] },
	tests: {
		selected: ['test/utils/impact-kernel.test.ts'],
		excluded: ['test/services/kernel-parity.test.ts', 'test/verify-range.e2e.test.ts'],
		removed: []
	},
	scenarios: { affected: ['run-impact-smoke'], unaffected: ['run-impact-history'] },
	uncertain: [
		{
			node: 'file:src/workflows/development-tooling/runImpact.types.ts',
			reason: 'global-change',
			detail: 'src/workflows/development-tooling/runImpact.types.ts'
		}
	]
};

const focusedText = [
	'Impact of working-tree against 6c1f0a4e9b2d7837f5a1c0e8d4b93a2f71e50d86 using the module runtime.',
	'Changed: 1 files.',
	'Units: 1 direct, 0 indirect, 0 added, 0 removed.',
	'Tests: 1 of 3 tests selected.',
	'  test/verify-range.e2e.test.ts',
	'Scenarios: 0 of 0 affected.'
].join('\n');

const widenedText = [
	'Impact of 9a8b7c6d5e4f30211a2b3c4d5e6f708192a3b4c5 against 3f9c2a1b7d4e5f60718293a4b5c6d7e8f9012345 using the process runtime.',
	'Changed: 1 files.',
	'Units: 1 direct, 0 indirect, 0 added, 0 removed.',
	'Tests: 1 of 3 tests selected.',
	'  test/utils/impact-kernel.test.ts',
	'Scenarios: 1 of 2 affected.',
	'  run-impact-smoke',
	'Selection was widened to every test:',
	'  global-change: file:src/workflows/development-tooling/runImpact.types.ts (src/workflows/development-tooling/runImpact.types.ts)'
].join('\n');

test('Renders selected impact details and widened uncertainty', () => {
	const focused = renderImpact(standard);
	const widenedSummary = renderImpact(widened);
	expect(focused).toBe(focusedText);
	expect(widenedSummary).toBe(widenedText);
	recordExampleCases(
		{
			unitId: 'workflow.run-impact',
			symbol: 'renderImpact',
			state: 'renders-selected-impact-details-and-widened-uncertainty',
			evidence: 'examples-cases',
			file: 'renders-selected-impact-details-and-widened-uncertainty.json'
		},
		[
			{ name: 'Renders selected tests for a focused report', input: standard, output: focused },
			{
				name: 'Renders affected scenarios and uncertainty for a widened report',
				input: widened,
				output: widenedSummary
			}
		]
	);
});
