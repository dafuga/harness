import { expect, test } from 'vitest';
import { budgetFindings } from '../../src/services/budget-service/budgetFindings';
import { type BudgetInput } from '../../src/utils/budgetFindings';

const commit = 'a'.repeat(40);
const comparison = {
	request: 'c'.repeat(64),
	boundary: 'fixture' as const,
	protocol: 'declared-constant/1',
	sampling: { warmup: 0, rounds: 1, iterations: 1 }
};
const method = 'Deterministic rule fixture.';
const performance = (metric: string, value: number | null, profile = 'p1') => ({
	unit: 'service.title',
	metric,
	unitOfMeasure: metric === 'throughput-ops' ? 'ops/s' : 'ms',
	value,
	...(value === null ? { unavailable: 'not measured' } : {}),
	method,
	workload: 'titles-1k',
	profile,
	target: 'module' as const,
	comparison,
	testedRevision: commit,
	artifacts: []
});
const size = (metric: string, value: number) => ({
	...performance(metric, value),
	unitOfMeasure: 'bytes',
	workload: null,
	profile: null,
	target: undefined
});
const baseline = (latency = 10, profile = 'p1') => ({
	metrics: { 'source-bytes': 100, complexity: 5, dependencies: 2 },
	performance: [
		{
			workload: 'titles-1k',
			metric: 'latency-warm-ms',
			target: 'module' as const,
			profile,
			value: latency,
			unitOfMeasure: 'ms',
			method,
			comparison
		},
		{
			workload: 'titles-1k',
			metric: 'throughput-ops',
			target: 'module' as const,
			profile,
			value: 100,
			unitOfMeasure: 'ops/s',
			method,
			comparison
		}
	]
});

function check(overrides: Partial<BudgetInput>) {
	return budgetFindings({
		unit: 'service.title',
		profile: 'p1',
		defaultTarget: 'module',
		budgets: [{ workload: 'titles-1k', metric: 'latency-warm-ms', tolerance: 0.05 }],
		measurements: [
			size('source-bytes', 100),
			size('complexity', 5),
			size('dependencies', 2),
			performance('latency-warm-ms', 10)
		],
		baseline: baseline(),
		checkSize: true,
		...overrides
	}).map((finding) => [finding.metric, finding.status]);
}

test('size, complexity and dependencies are frozen: any growth is exceeded', () => {
	expect(check({})).toEqual([
		['source-bytes', 'passed'],
		['complexity', 'passed'],
		['dependencies', 'passed'],
		['latency-warm-ms', 'passed']
	]);
	const grown = [size('source-bytes', 101), size('complexity', 4), size('dependencies', 3)];
	expect(
		check({ measurements: [...grown, performance('latency-warm-ms', 10)] }).slice(0, 3)
	).toEqual([
		['source-bytes', 'exceeded'],
		['complexity', 'passed'],
		['dependencies', 'exceeded']
	]);
});

test('performance tolerates exactly five percent in the direction that is worse', () => {
	const latency = (value: number) =>
		check({ measurements: [performance('latency-warm-ms', value)], checkSize: false });
	expect(latency(10.5)).toEqual([['latency-warm-ms', 'passed']]);
	expect(latency(10.51)).toEqual([['latency-warm-ms', 'exceeded']]);
	expect(latency(4)).toEqual([['latency-warm-ms', 'passed']]);
	const throughput = (value: number) =>
		check({
			budgets: [{ workload: 'titles-1k', metric: 'throughput-ops', tolerance: 0.05 }],
			measurements: [performance('throughput-ops', value)],
			checkSize: false
		});
	expect(throughput(95)).toEqual([['throughput-ops', 'passed']]);
	expect(throughput(94.9)).toEqual([['throughput-ops', 'exceeded']]);
	expect(throughput(300)).toEqual([['throughput-ops', 'passed']]);
});

test('missing or incompatible evidence is never a pass', () => {
	const only = (overrides: Partial<BudgetInput>) => check({ checkSize: false, ...overrides });
	expect(only({ measurements: [] })).toEqual([['latency-warm-ms', 'missing-measurement']]);
	expect(only({ measurements: [performance('latency-warm-ms', null)] })).toEqual([
		['latency-warm-ms', 'missing-measurement']
	]);
	expect(only({ measurements: [performance('latency-warm-ms', 10, 'p2')] })).toEqual([
		['latency-warm-ms', 'missing-measurement']
	]);
	expect(only({ baseline: baseline(10, 'p2') })).toEqual([['latency-warm-ms', 'incompatible']]);
	expect(only({ baseline: undefined })).toEqual([['latency-warm-ms', 'missing-baseline']]);
	expect(check({ baseline: undefined }).slice(0, 3)).toEqual([
		['source-bytes', 'missing-baseline'],
		['complexity', 'missing-baseline'],
		['dependencies', 'missing-baseline']
	]);
	const absent = [performance('latency-warm-ms', 10)];
	expect(check({ measurements: absent })[0]).toEqual(['source-bytes', 'missing-measurement']);
});
