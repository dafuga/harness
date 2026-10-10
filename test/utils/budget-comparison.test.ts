import { expect, test } from 'vitest';
import {
	budgetFindings,
	comparisonContext,
	comparisonSchema,
	performanceBaselineSchema
} from '../../src/lib/verification';

const request = { operation: 'rank', input: { size: 20000, seed: 7 } };
const context = comparisonContext(request, { rounds: 5, iterations: 30 });
const method = 'Fastest of 5 rounds of 30 end-to-end calls through the declared module target.';
const identity = { workload: 'rank-20k', metric: 'latency-floor-ms', target: 'module' as const };
const measurement = {
	...identity,
	unit: 'function.rank',
	unitOfMeasure: 'ms',
	value: 10,
	method,
	profile: 'p1',
	comparison: context
};
const frozen = {
	...identity,
	profile: 'p1',
	value: 10,
	unitOfMeasure: 'ms',
	method,
	comparison: context
};

function judge(measured: object, baselines: object[] = [frozen]) {
	const [finding] = budgetFindings({
		unit: 'function.rank',
		profile: 'p1',
		defaultTarget: 'module',
		budgets: [{ workload: 'rank-20k', metric: 'latency-floor-ms', tolerance: 0.05 }],
		measurements: [measured as never],
		baseline: { metrics: {}, performance: baselines as never },
		checkSize: false
	});
	return finding;
}
const without = (source: object, key: string) =>
	Object.fromEntries(Object.entries(source).filter(([name]) => name !== key));

test('the context is derived from the complete request and the sampling actually used', () => {
	expect(comparisonSchema.parse(context)).toEqual({
		request: expect.stringMatching(/^[0-9a-f]{64}$/),
		boundary: 'public-invocation',
		protocol: expect.stringMatching(/\S/),
		sampling: { warmup: expect.any(Number), rounds: 5, iterations: 30 }
	});
	const reordered = { input: { seed: 7, size: 20000 }, operation: 'rank' };
	expect(comparisonContext(reordered, { rounds: 5, iterations: 30 })).toEqual(context);
	const cheaper = comparisonContext(
		{ operation: 'rank', input: { size: 1, seed: 7 } },
		{ rounds: 5, iterations: 30 }
	);
	expect(cheaper.request).not.toBe(context.request);
	expect(cheaper.sampling).toEqual(context.sampling);
	const fewer = comparisonContext(request, { rounds: 5, iterations: 3 });
	expect(fewer.request).toBe(context.request);
	expect(fewer.sampling).not.toEqual(context.sampling);
});

test('identical definitions compare with the exact five percent limit', () => {
	expect(judge(measurement)).toEqual({
		unit: 'function.rank',
		metric: 'latency-floor-ms',
		status: 'passed',
		baseline: 10,
		measured: 10,
		detail: 'rank-20k on the module target'
	});
	expect(judge({ ...measurement, value: 10.5 }).status).toBe('passed');
	expect(judge({ ...measurement, value: 10.51 }).status).toBe('exceeded');
	expect(judge({ ...measurement, value: 2 }).status).toBe('passed');
});

test('a measurement in another unit of measure is never compared', () => {
	const seconds = judge({ ...measurement, unitOfMeasure: 'seconds', value: 10.1 });
	expect(seconds).toMatchObject({ status: 'incompatible', baseline: null, measured: 10.1 });
	expect(seconds.differences).toEqual(['unit of measure is seconds, the baseline is in ms']);
	expect(judge({ ...measurement, unitOfMeasure: 'seconds', value: 0.01 }).status).toBe(
		'incompatible'
	);
	const both = judge({ ...measurement, unitOfMeasure: 'seconds' }, [
		{ ...frozen, unitOfMeasure: 'seconds' }
	]);
	expect(both.status).toBe('incompatible');
	expect(both.differences).toEqual(['unit of measure is seconds, latency-floor-ms is in ms']);
});

test('the same workload name with another request, sampling, boundary, protocol or method is incompatible', () => {
	const cheaper = comparisonContext(
		{ operation: 'rank', input: { size: 1, seed: 7 } },
		{ rounds: 5, iterations: 30 }
	);
	const improved = judge({ ...measurement, value: 0.001, comparison: cheaper });
	expect(improved).toMatchObject({ status: 'incompatible', baseline: null, measured: 0.001 });
	expect(improved.differences).toEqual([
		`request ${cheaper.request.slice(0, 12)} differs from the baseline request ${context.request.slice(0, 12)}`
	]);
	const differs = (comparison: object, extra: object = {}) =>
		judge({ ...measurement, ...extra, comparison }).differences;
	expect(differs(comparisonContext(request, { rounds: 5, iterations: 3 }))).toEqual([
		'sampling is 5 rounds of 3 calls after 3 warm-up calls, the baseline used 5 rounds of 30 calls after 3 warm-up calls'
	]);
	expect(differs({ ...context, boundary: 'fixture' })).toEqual([
		'measured boundary is fixture, the baseline measured public-invocation'
	]);
	expect(differs({ ...context, protocol: 'other-tool/2' })).toEqual([
		`protocol is other-tool/2, the baseline used ${context.protocol}`
	]);
	const inner = judge({
		...measurement,
		method: 'Isolated kernel timing; no invocation overhead.'
	});
	expect(inner.status).toBe('incompatible');
	expect(inner.differences).toEqual(['method description differs from the baseline']);
});

test('missing comparison metadata is incomplete on either side, never a pass', () => {
	const unlabelled = judge(without(measurement, 'comparison'));
	expect(unlabelled).toMatchObject({ status: 'incomplete', baseline: null, measured: 10 });
	expect(unlabelled.differences).toEqual(['the measurement states no comparison context']);
	expect(judge(measurement, [without(frozen, 'comparison')])).toMatchObject({
		status: 'incomplete',
		differences: ['the baseline states no comparison context']
	});
	expect(judge(measurement, [without(frozen, 'unitOfMeasure')]).status).toBe('incomplete');
	expect(judge(measurement, [without(frozen, 'method')]).status).toBe('incomplete');
	const bare = { ...identity, profile: 'p1', value: 10 };
	const labelOnly = {
		...without(measurement, 'comparison'),
		unitOfMeasure: 'seconds',
		value: 0.01
	};
	expect(judge(labelOnly, [bare]).status).toBe('incomplete');
	expect(judge({ ...measurement, comparison: { ...context, request: 'rank-20k' } }).status).toBe(
		'incomplete'
	);
});

test('each machine profile keeps its own baseline, and another profile is incompatible', () => {
	const elsewhere = { ...frozen, profile: 'p2', value: 3 };
	expect(judge(measurement, [elsewhere])).toMatchObject({
		status: 'incompatible',
		baseline: null
	});
	expect(judge({ ...measurement, value: 10.4 }, [elsewhere, frozen])).toMatchObject({
		status: 'passed',
		baseline: 10
	});
});

test('a ledger line freezes the whole definition, not a label', () => {
	expect(performanceBaselineSchema.safeParse(frozen).success).toBe(true);
	for (const key of ['unitOfMeasure', 'method', 'comparison']) {
		expect(performanceBaselineSchema.safeParse(without(frozen, key)).success).toBe(false);
	}
	const vague = { ...frozen, comparison: { ...context, request: 'rank-20k' } };
	expect(performanceBaselineSchema.safeParse(vague).success).toBe(false);
});
