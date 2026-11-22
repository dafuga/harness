import type { Ledger, Manifests, Context } from './service.budget.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { BudgetService } from '../../src/services/verification-evidence/budget-service/BudgetService';
import type { UnitBaseline } from '../../src/services/verification-evidence/budget-service/BudgetService.types';

const unitId = 'service.budget';
const service = new BudgetService();

function checkout(value: number) {
	return { workload: 'checkout', metric: 'throughput-ops', target: 'node', profile: 'ci', value };
}

function summarise(baselines: Map<string, UnitBaseline>) {
	return Object.fromEntries(
		Array.from(baselines, ([unit, limits]) => [
			unit,
			{
				metrics: limits.metrics,
				unmeasured: limits.unmeasured ?? null,
				performance: limits.performance.length,
				inheritedFrom: limits.inheritedFrom ?? null
			}
		])
	);
}

const ledger = [
	{ type: 'baseline', unit: 'budget.alpha', metrics: { 'memory-bytes': 1000 }, performance: [checkout(100)] },
	{ type: 'approval', unit: 'budget.alpha', after: { 'memory-bytes': 1200 }, performance: [checkout(120)] }
] as unknown as Ledger;

const manifests = [
	{ id: 'budget.beta', lineage: { predecessors: ['budget.alpha'] } },
	{ id: 'budget.gamma' }
] as unknown as Manifests;

const retiredLedger = [
	{ type: 'baseline', unit: 'budget.alpha', metrics: { 'memory-bytes': 1000 }, performance: [] },
	{
		type: 'review',
		unit: 'budget.alpha',
		after: {},
		unmeasured: { 'memory-bytes': 'runtime has no heap counter' },
		performance: []
	}
] as unknown as Ledger;

test('Folds ledger events and inherits a predecessor baseline', () => {
	const baselines = service.baselines(ledger, manifests);

	expect(baselines.get('budget.alpha')?.metrics).toEqual({ 'memory-bytes': 1200 });
	expect(baselines.get('budget.alpha')?.performance).toHaveLength(1);
	expect(baselines.get('budget.beta')?.inheritedFrom).toBe('budget.alpha');
	expect(baselines.has('budget.gamma')).toBe(false);
	recordExampleCases(
		{
			unitId,
			symbol: 'baselines',
			state: 'folds-ledger-events-and-inherits-a-predecessor-baseline',
			evidence: 'examples-cases',
			file: 'folds-ledger-events-and-inherits-a-predecessor-baseline.json'
		},
		[
			{
				name: 'approval raises the frozen limit and a unit without limits inherits from its predecessor',
				input: { events: ledger, manifests },
				output: summarise(baselines)
			}
		]
	);
});

test('Drops a frozen limit that a later line records unmeasured', () => {
	const baselines = service.baselines(retiredLedger, []);

	expect(baselines.get('budget.alpha')?.metrics).toEqual({});
	expect(baselines.get('budget.alpha')?.unmeasured).toEqual({
		'memory-bytes': 'runtime has no heap counter'
	});
	recordExampleCases(
		{
			unitId,
			symbol: 'baselines',
			state: 'drops-a-frozen-limit-that-a-later-line-records-unmeasured',
			evidence: 'examples-cases',
			file: 'drops-a-frozen-limit-that-a-later-line-records-unmeasured.json'
		},
		[
			{
				name: 'a later statement that a metric is unmeasured replaces its frozen number',
				input: { events: retiredLedger, manifests: [] },
				output: summarise(baselines)
			}
		]
	);
});

test('Evaluates no subjects to an empty report', () => {
	const context: Context = { measurements: [], baselines: new Map(), profile: 'ci' };
	const report = service.evaluate([], context);

	expect(report).toEqual({ findings: [], failures: [] });
	recordExampleCases(
		{
			unitId,
			symbol: 'evaluate',
			state: 'evaluates-no-subjects-to-an-empty-report',
			evidence: 'examples-cases',
			file: 'evaluates-no-subjects-to-an-empty-report.json'
		},
		[
			{
				name: 'no subjects, no measurements and no baselines give no findings and no failures',
				input: { subjects: [], profile: 'ci' },
				output: report
			}
		]
	);
});
