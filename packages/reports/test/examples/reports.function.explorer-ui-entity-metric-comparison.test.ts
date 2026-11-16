import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { entityMetricComparison } from '../../src/utils/explorer-ui/entityMetricComparison';
import type { MetricHost } from '../../src/utils/explorer-ui/entityMetricComparison.types';

type Host = MetricHost;
type Head = Host['head'];
type Entity = Parameters<typeof entityMetricComparison>[1];
type Measure = Parameters<typeof entityMetricComparison>[2];
type Result = ReturnType<typeof entityMetricComparison>;
type UnitEntry = ReturnType<typeof unitFor>;

const PAGE_ID = 'reports.page.harness-branch-branch-at-models';
const HEAD_COMMIT = 'e4c1a92f7b0d3856ac19f2e47d0b8e61c53a9d07';
const PARENT_COMMIT = '9a2f6c1e0d7b4835f1e9c02a6b7d3e48a0c5f619';
const ROUTE_PATH = '/harness/branch/[branch]/[...at]/models';

const MEASURE = {
	size: [{ label: 'Source size', value: '19.1 KB', rawValue: 19104, unitOfMeasure: 'bytes' }],
	performance: []
} as unknown as Measure;

function unitFor(id: string, status: string, bytes: number, complexity: number) {
	return {
		id,
		kind: 'page',
		status,
		title: ROUTE_PATH,
		responsibility: `Owns the ${ROUTE_PATH} route page.`,
		dependencies: [],
		scenarios: [],
		owns: { source: [`packages/reports/src/routes/harness/branch${ROUTE_PATH}/+page.svelte`], symbols: ['+page'] },
		contract: { inputs: [], outputs: [{ name: '+page', type: 'markup' }], errors: [] },
		runtime: { kind: 'module', targets: [] },
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] },
		sourceMeasurements: [
			{ unit: id, metric: 'source-bytes', unitOfMeasure: 'bytes', value: bytes, workload: null, profile: null },
			{ unit: id, metric: 'complexity', unitOfMeasure: 'points', value: complexity, workload: null, profile: null }
		],
		version: '5d1e8a03c47b9f26'
	};
}

function revision(commit: string, units: UnitEntry[]): Head {
	return {
		commit,
		registry: { available: true, units, scenarios: [], graph: { edges: [] } },
		comparison: null,
		records: [],
		explanations: []
	} as unknown as Head;
}

function hostFor(parent: Head | null, head: Head, category = 'pages'): Host {
	return {
		head,
		parent,
		route: { branch: 'main', commit: HEAD_COMMIT, category, entity: PAGE_ID }
	} as unknown as Host;
}

function entityFor(lastAt?: string): Entity {
	return {
		id: PAGE_ID,
		category: 'pages',
		role: 'Page',
		name: 'Models',
		purpose: `Owns the ${ROUTE_PATH} route page.`,
		unit: unitFor(PAGE_ID, 'active', 19104, 44),
		verdict: { passed: false, label: 'Evidence missing', reasons: ['No verification record is attached to this commit.'] },
		change: null,
		appRoute: ROUTE_PATH,
		lastAt
	} as unknown as Entity;
}

function summary(result: Result) {
	if (!result) return null;
	return {
		beforeCommit: result.before.commit,
		afterCommit: result.after.commit,
		beforeBytes: result.before.measure.size.map((row) => row.rawValue),
		afterBytes: result.after.measure.size.map((row) => row.rawValue)
	};
}

test('Pairs the first parent Page measure with the head measure', () => {
	const parent = revision(PARENT_COMMIT, [unitFor(PAGE_ID, 'active', 18432, 42)]);
	const head = revision(HEAD_COMMIT, [unitFor(PAGE_ID, 'active', 19104, 44)]);
	const result = entityMetricComparison(hostFor(parent, head), entityFor(), MEASURE);
	expect(result?.before.commit).toBe(PARENT_COMMIT);
	expect(result?.after).toEqual({ commit: HEAD_COMMIT, measure: MEASURE });
	expect(result?.before.measure.size.map((row) => row.rawValue)).toContain(18432);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-entity-metric-comparison',
			symbol: 'entityMetricComparison',
			state: 'pairs-the-first-parent-page-measure-with-the-head-measure',
			evidence: 'examples-cases',
			file: 'pairs-the-first-parent-page-measure-with-the-head-measure.json'
		},
		[
			{
				name: 'parent and head both carry the active Page',
				input: { parentCommit: PARENT_COMMIT, headCommit: HEAD_COMMIT, entity: PAGE_ID, helper: null },
				output: summary(result)
			}
		]
	);
});

test('Yields no comparison for a first commit, a helper or a removed Page', () => {
	const parent = revision(PARENT_COMMIT, [unitFor(PAGE_ID, 'active', 18432, 42)]);
	const head = revision(HEAD_COMMIT, [unitFor(PAGE_ID, 'active', 19104, 44)]);
	const results = [
		entityMetricComparison(hostFor(null, head), entityFor(), MEASURE),
		entityMetricComparison(hostFor(parent, head), entityFor(), MEASURE, 'explorerVerdict'),
		entityMetricComparison(hostFor(parent, head), entityFor(PARENT_COMMIT), MEASURE),
		entityMetricComparison(hostFor(parent, head, 'harness'), entityFor(), MEASURE)
	];
	expect(results).toEqual([null, null, null, null]);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-entity-metric-comparison',
			symbol: 'entityMetricComparison',
			state: 'yields-no-comparison-for-a-first-commit-a-helper-or-a-remove',
			evidence: 'examples-cases',
			file: 'yields-no-comparison-for-a-first-commit-a-helper-or-a-remove.json'
		},
		[
			{ name: 'first commit has no parent revision', input: { parent: null, helper: null }, output: null },
			{ name: 'a helper is selected', input: { helper: 'explorerVerdict' }, output: null },
			{ name: 'entity carries lastAt because the commit removed it', input: { lastAt: PARENT_COMMIT }, output: null },
			{ name: 'route category is not pages', input: { routeCategory: 'harness' }, output: null }
		]
	);
});

test('Yields no comparison when a registry lacks the active Page', () => {
	const head = revision(HEAD_COMMIT, [unitFor(PAGE_ID, 'active', 19104, 44)]);
	const retiredParent = revision(PARENT_COMMIT, [unitFor(PAGE_ID, 'retired', 18432, 42)]);
	const missingParent = revision(PARENT_COMMIT, []);
	const missingHead = revision(HEAD_COMMIT, []);
	const results = [
		entityMetricComparison(hostFor(retiredParent, head), entityFor(), MEASURE),
		entityMetricComparison(hostFor(missingParent, head), entityFor(), MEASURE),
		entityMetricComparison(hostFor(retiredParent, missingHead), entityFor(), MEASURE)
	];
	expect(results).toEqual([null, null, null]);
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-entity-metric-comparison',
			symbol: 'entityMetricComparison',
			state: 'yields-no-comparison-when-a-registry-lacks-the-active-page',
			evidence: 'examples-cases',
			file: 'yields-no-comparison-when-a-registry-lacks-the-active-page.json'
		},
		[
			{ name: 'parent registry lists the Page as retired', input: { parentStatus: 'retired' }, output: null },
			{ name: 'parent registry has no unit with the entity id', input: { parentUnits: 0 }, output: null },
			{ name: 'head registry has no unit with the entity id', input: { headUnits: 0 }, output: null }
		]
	);
});
