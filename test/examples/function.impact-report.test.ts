import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { Assembly } from '../../src/services/reports-media/impact-service/impactReport.types';
import { impactReport } from '../../src/services/reports-media/impact-service/impactReport';
import { graphTests } from '../../src/utils/reports-media/impactReport';

const sourceGraph = {
	nodes: [
		{ id: 'file:src/a.test.ts', kind: 'test' },
		{ id: 'file:src/b.spec.ts', kind: 'test' },
		{ id: 'file:src/app.ts', kind: 'source' },
		{ id: 'file:src/ignored.js', kind: 'test' }
	],
	edges: [],
	uncertain: []
};

const scenarios = [
	{
		id: 'smoke',
		tests: [{ id: 'smoke-test', kind: 'unit', runner: 'vitest', cwd: 'src', target: 'a.test.ts' }]
	},
	{
		id: 'full',
		tests: [{ id: 'full-test', kind: 'unit', runner: 'vitest', cwd: 'test', target: 'b.spec.ts' }]
	}
] as Assembly['sides']['head']['scenarios'];

const assembly = (expanded: boolean): Assembly => ({
	sides: {
		base: {
			revision: 'base',
			config: {} as Assembly['sides']['base']['config'],
			entries: [],
			manifests: [],
			scenarios: [],
			graph: { nodes: [], edges: [], uncertain: [] }
		},
		head: {
			revision: 'head',
			config: {} as Assembly['sides']['head']['config'],
			entries: [],
			manifests: [],
			scenarios,
			graph: sourceGraph as Assembly['sides']['head']['graph']
		}
	},
	seeds: {
		changed: [],
		seeds: [],
		direct: new Set(['unit-a']),
		expansions: expanded
			? [{ node: 'global', reason: 'global-change', detail: 'global config changed' }]
			: []
	},
	output: {
		affected: expanded
			? []
			: [{ id: 'scenario:smoke', distance: 1, via: 'head', presence: 'both', seed: 'changed' }],
		uncovered: [],
		unknown: []
	}
});

test('Graph tests include only test nodes with supported extension', () => {
	const result = graphTests(sourceGraph as Parameters<typeof graphTests>[0]);
	const state = 'graph-tests-include-only-test-nodes-with-supported-extension';
	expect(result).toEqual(['src/a.test.ts', 'src/b.spec.ts']);
	recordExampleCases(
		{
			unitId: 'function.impact-report',
			symbol: 'graphTests',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'test and spec nodes, excluding source and unsupported extension',
				input: sourceGraph,
				output: result
			}
		]
	);
});

test('Unbounded changes select every current test and scenario', () => {
	const result = impactReport(assembly(true));
	const state = 'unbounded-changes-select-every-current-test-and-scenario';
	expect(result).toMatchObject({
		expanded: true,
		tests: { selected: ['src/a.test.ts', 'src/b.spec.ts'], excluded: [] },
		scenarios: { affected: ['full', 'smoke'], unaffected: [] }
	});
	recordExampleCases(
		{
			unitId: 'function.impact-report',
			symbol: 'impactReport',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'global change widens selection',
				input: { expansions: [{ node: 'global', reason: 'global-change' }] },
				output: { expanded: result.expanded, tests: result.tests, scenarios: result.scenarios }
			}
		]
	);
});

test('Reachable scenarios select their tests without widening', () => {
	const result = impactReport(assembly(false));
	const state = 'reachable-scenarios-select-their-tests-without-widening';
	expect(result).toMatchObject({
		expanded: false,
		tests: { selected: ['src/a.test.ts'], excluded: ['src/b.spec.ts'] },
		scenarios: { affected: ['smoke'], unaffected: ['full'] }
	});
	recordExampleCases(
		{
			unitId: 'function.impact-report',
			symbol: 'impactReport',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'one reachable scenario',
				input: { affected: ['scenario:smoke'] },
				output: { expanded: result.expanded, tests: result.tests, scenarios: result.scenarios }
			}
		]
	);
});
