import { test } from 'vitest';
import {
	budgetsLedger,
	defaultGlobalFiles,
	defaultUnitsConfig,
	pathMatches,
	scenariosDirectory,
	unitsConfigFile,
	unitsConfigSchema,
	unitsDirectory,
	workloadsDirectory
} from '../../src/core/development-tooling/unitsConfig';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Matches exact prefix and wildcard paths', () => {
	const cases = [
		{ name: 'exact source path', input: ['src/core/unitsConfig.ts', 'src/core/unitsConfig.ts'], output: true },
		{ name: 'core folder prefix', input: ['src/core/unitsConfig.ts', 'src/core/'], output: true },
		{ name: 'glob crosses folders', input: ['src/core/development-tooling/unitsConfig.ts', '**/*.ts'], output: true },
		{ name: 'single star stays in segment', input: ['src/core/development-tooling/unitsConfig.ts', 'src/*/unitsConfig.ts'], output: false }
	] as const;
	const results = cases.map(({ input }) => pathMatches(input[0], input[1]));
	expect(results).toEqual(cases.map(({ output }) => output));
	recordExampleCases(
		{
			unitId: 'function.units-config',
			symbol: 'pathMatches',
			state: 'matches-exact-prefix-and-wildcard-paths',
			evidence: 'examples-cases',
			file: 'matches-exact-prefix-and-wildcard-paths.json'
		},
		cases.map(({ name, input, output }) => ({ name, input, output }))
	);
});

test('Provides strict unit indexing defaults', () => {
	const valid = unitsConfigSchema.safeParse(defaultUnitsConfig);
	const invalid = unitsConfigSchema.safeParse({ ...defaultUnitsConfig, extra: true });
	const summary = {
		locations: [unitsConfigFile, unitsDirectory, scenariosDirectory, budgetsLedger, workloadsDirectory],
		globalFileCount: defaultGlobalFiles.length,
		includesConfigFile: defaultGlobalFiles.includes(unitsConfigFile),
		defaults: defaultUnitsConfig,
		validDefault: valid.success,
		rejectsUnknownField: !invalid.success
	};
	expect(summary).toEqual({
		locations: ['harness.units.json', 'specification/units', 'specification/scenarios', 'specification/budgets/ledger.ndjson', 'specification/workloads'],
		globalFileCount: 21,
		includesConfigFile: true,
		defaults: {
			schemaVersion: 1,
			workspaces: [{ name: '', root: '.' }],
			tests: ['test/', 'tests/'],
			global: [],
			ignored: ['**/*.md', 'specification/features/', 'specification/loops/', '.gitignore'],
			references: []
		},
		validDefault: true,
		rejectsUnknownField: true
	});
	recordExampleCases(
		{
			unitId: 'function.units-config',
			symbol: 'unitsConfigSchema',
			state: 'provides-strict-unit-indexing-defaults',
			evidence: 'examples-cases',
			file: 'provides-strict-unit-indexing-defaults.json'
		},
		[
			{
				name: 'default config and registry paths',
				input: defaultUnitsConfig,
				output: { locations: summary.locations, globalFileCount: 21, valid: true }
			},
			{
				name: 'unknown configuration fields are rejected',
				input: { ...defaultUnitsConfig, extra: true },
				output: { valid: false, errorCount: invalid.success ? 0 : invalid.error.issues.length }
			}
		]
	);
});
