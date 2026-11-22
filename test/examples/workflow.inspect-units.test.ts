import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { unitSchema, showUnit } from '../../src/cli/program/inspectUnits';
import { testAttribution } from '../../src/cli/program/testAttribution';

test('Returns the requested scenario manifest schema', () => {
	const schema = unitSchema('ScenarioManifest') as { properties: Record<string, unknown> };
	expect(schema.properties).toHaveProperty('states');
	recordExampleCases(
		{ unitId: 'workflow.inspect-units', symbol: 'unitSchema', state: 'returns-the-requested-scenario-manifest-schema', evidence: 'examples-cases', file: 'returns-the-requested-scenario-manifest-schema.json' },
		[{ name: 'scenario schema exposes states', input: { name: 'ScenarioManifest' }, output: { properties: Object.keys(schema.properties).sort() } }]
	);
});

test('Throws ExpectedCliError when the schema name is unknown', () => {
	expect(() => unitSchema('UnknownManifest')).toThrow('Unknown schema "UnknownManifest"');
	recordExampleCases(
		{ unitId: 'workflow.inspect-units', symbol: 'unitSchema', state: 'throws-expectedclierror-when-the-schema-name-is-unknown', evidence: 'examples-cases', file: 'throws-expectedclierror-when-the-schema-name-is-unknown.json' },
		[{ name: 'unknown schema name', input: { name: 'UnknownManifest' }, error: 'ExpectedCliError: Unknown schema "UnknownManifest"' }]
	);
});

test('Throws ExpectedCliError when the requested unit is unknown', async () => {
	await expect(showUnit('workflow.inspect-units-missing')).rejects.toThrow('Unknown unit "workflow.inspect-units-missing"');
	recordExampleCases(
		{ unitId: 'workflow.inspect-units', symbol: 'showUnit', state: 'throws-expectedclierror-when-the-requested-unit-is-unknown', evidence: 'examples-cases', file: 'throws-expectedclierror-when-the-requested-unit-is-unknown.json' },
		[{ name: 'unknown unit id', input: { id: 'workflow.inspect-units-missing' }, error: 'ExpectedCliError: Unknown unit "workflow.inspect-units-missing"' }]
	);
});

test('Attributes a direct runtime test and matching scenario', () => {
	const source = 'src/cli/program/inspectUnits.ts';
	const testFile = 'src/cli/program/inspectUnits.test.ts';
	const manifest = {
		schemaVersion: 1 as const, id: 'workflow.inspect-units', uid: 'u_76b76sztpq', kind: 'workflow', title: 'inspectUnits',
		responsibility: 'Owns the inspectUnits command workflow.', responsibilityOrigin: 'derived' as const, status: 'active' as const,
		owns: { source: [source], symbols: ['unitSchema'] },
		contract: { origin: 'declared' as const, inputs: [], outputs: [], errors: [] }, dependencies: [],
		runtime: { kind: 'module' as const, entry: source, targets: [{ kind: 'module' as const, entry: source }] }, scenarios: [],
		budgets: { size: 'frozen' as const, complexity: 'frozen' as const, performance: [] }
	};
	const graph = {
		nodes: [{ id: `file:${testFile}`, kind: 'test' as const }, { id: `file:${source}`, kind: 'source' as const }],
		edges: [{ from: `file:${testFile}`, to: `file:${source}`, via: 'import', typeOnly: false }], uncertain: []
	};
	const scenarios = [{ schemaVersion: 1 as const, id: 'scenario.inspect-units', title: 'Inspect units', kind: 'headless' as const,
		units: ['workflow.inspect-units'], states: [{ id: 'state.default', title: 'Default', coverage: 'required' as const }],
		viewports: [], tests: [{ id: 'test.inspect-units', kind: 'unit' as const, runner: 'vitest' as const, target: testFile }], evidence: [] }];
	const result = testAttribution(graph, manifest, scenarios);
	expect(result.directImports.map((entry) => entry.file)).toEqual([testFile]);
	recordExampleCases(
		{ unitId: 'workflow.inspect-units', symbol: 'testAttribution', state: 'attributes-a-direct-runtime-test-and-matching-scenario', evidence: 'examples-cases', file: 'attributes-a-direct-runtime-test-and-matching-scenario.json' },
		[{ name: 'owned source import is direct and scenario is retained', input: { testFile, source, scenario: 'scenario.inspect-units' }, output: { direct: result.directImports.map((entry) => entry.file), transitive: result.transitiveImpacts.map((entry) => entry.file), scenarios: result.scenarios.map((entry) => entry.id) } }]
	);
});
