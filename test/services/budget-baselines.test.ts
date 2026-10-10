import { expect, test } from 'vitest';
import type { BudgetEvent, PerformanceBaselineEntry } from '../../src/core/budgetTypes';
import { BudgetService } from '../../src/services/BudgetService';
import { comparisonContext } from '../../src/utils/comparisonContext';

const sampling = { rounds: 5, iterations: 30 };
const original = comparisonContext({ operation: 'rank', input: { size: 20000 } }, sampling);
const cheaper = comparisonContext({ operation: 'rank', input: { size: 1 } }, sampling);
const entry = (
	profile: string,
	value: number,
	comparison = original
): PerformanceBaselineEntry => ({
	workload: 'rank-20k',
	metric: 'latency-floor-ms',
	target: 'module',
	profile,
	value,
	unitOfMeasure: 'ms',
	method: 'Fastest end-to-end call.',
	comparison
});
const signed = {
	unit: 'function.rank',
	record: { id: 'record', commit: 'a'.repeat(40), tree: 'b'.repeat(40) },
	reviewer: 'Reviewer One',
	reason: 'Reviewed.',
	at: '2026-10-10T00:00:00.000Z'
};
const metrics = { 'source-bytes': 10, complexity: 1, dependencies: 0 };
const approval = (performance: PerformanceBaselineEntry[]): BudgetEvent => ({
	type: 'approval',
	...signed,
	before: metrics,
	after: metrics,
	performance
});

test('an approval replaces only the baseline of its own workload, target and profile', () => {
	const events: BudgetEvent[] = [
		{ type: 'baseline', ...signed, metrics, performance: [entry('p1', 4)] },
		approval([entry('p2', 9)]),
		approval([entry('p1', 0.001, cheaper)])
	];
	const before = JSON.stringify(events);
	const current = new BudgetService().baselines(events, []).get('function.rank');
	expect(current?.performance).toEqual([entry('p2', 9), entry('p1', 0.001, cheaper)]);
	// The ledger itself still holds the first definition and value.
	expect(JSON.stringify(events)).toBe(before);
	expect(events[0].performance[0]).toEqual(entry('p1', 4));
});
