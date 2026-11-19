import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { budgetFindings } from '../../src/services/budget-service/budgetFindings';
import { performanceLimit } from '../../src/utils/budgetFindings';
import type { BudgetBaseline, BudgetInput, Measured } from '../../src/utils/budgetFindings';
import type { BudgetFinding } from '../../src/core/verification-evidence/verificationTypes';

const unit = 'function.budget-findings';
const workload = 'parse one ledger line';
const onModule = `${workload} on the module target`;
const method = 'Median of timed rounds.';
const comparison = {
	request: 'c'.repeat(64),
	boundary: 'public-invocation' as const,
	protocol: 'harness-rounds/1',
	sampling: { warmup: 3, rounds: 5, iterations: 20 }
};
const definition = {
	workload,
	target: 'module' as const,
	profile: 'linux-x64-ci',
	method,
	comparison
};
const limit = (metric: string, value: number, unitOfMeasure: string) => ({
	...definition,
	metric,
	value,
	unitOfMeasure
});

const reviewed: BudgetBaseline = {
	metrics: {
		'source-bytes': 18432,
		complexity: 37,
		dependencies: 6,
		'artifact-bytes:module': 19000
	},
	performance: [limit('latency-warm-ms', 10, 'ms'), limit('throughput-ops', 100, 'ops/s')]
};

const bytes = { unit, workload: null, profile: null, unitOfMeasure: 'bytes' };
const sizeOf = (metric: string, value: number | null, extra: Partial<Measured> = {}): Measured => ({
	...bytes,
	metric,
	value,
	...extra
});

const timed = (metric: string, value: number | null, extra: Partial<Measured> = {}): Measured => ({
	...definition,
	unit,
	metric,
	value,
	unitOfMeasure: 'ms',
	...extra
});

const passing: Measured[] = [
	sizeOf('source-bytes', 18432),
	sizeOf('complexity', 37),
	sizeOf('dependencies', 6),
	sizeOf('artifact-bytes', 19000, { target: 'module' }),
	timed('latency-warm-ms', 10)
];

const inputFor = (overrides: Partial<BudgetInput>): BudgetInput => ({
	unit,
	profile: 'linux-x64-ci',
	defaultTarget: 'module',
	budgets: [{ workload, metric: 'latency-warm-ms', tolerance: 0.05 }],
	measurements: passing,
	baseline: reviewed,
	checkSize: true,
	...overrides
});

const sourceFinding = (status: BudgetFinding['status'], extra: Partial<BudgetFinding> = {}) => ({
	unit,
	metric: 'source-bytes',
	baseline: 18432,
	measured: null,
	status,
	...extra
});

const latencyFinding = (status: BudgetFinding['status'], extra: Partial<BudgetFinding> = {}) => ({
	unit,
	metric: 'latency-warm-ms',
	baseline: 10,
	measured: 10,
	status,
	detail: onModule,
	...extra
});

const recorded = (state: string) => ({
	unitId: unit,
	symbol: 'budgetFindings',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

const reason = 'Not measured: src/parser/grammar.ts was not read.';
const unavailableSource = sizeOf('source-bytes', null, { unavailable: reason });
const otherFrozen = passing.slice(1);
const reviewedGap = { ...reviewed, unmeasured: { 'source-bytes': reason } };

const unavailableCases = [
	{
		name: 'reviewed unavailable size keeps its reason',
		input: { measurements: [unavailableSource, ...otherFrozen], baseline: reviewedGap },
		output: sourceFinding('unavailable', { detail: reason })
	},
	{
		name: 'unreviewed gap is a missing measurement',
		input: { measurements: [unavailableSource, ...otherFrozen] },
		output: sourceFinding('missing-measurement', { detail: reason })
	}
];

const perf = { checkSize: false };
const comparisonCases = [
	{
		name: 'latency beyond tolerance is exceeded',
		input: { ...perf, measurements: [timed('latency-warm-ms', 10.6)] },
		output: latencyFinding('exceeded', { measured: 10.6 })
	},
	{
		name: 'throughput below its limit is exceeded',
		input: {
			...perf,
			budgets: [{ workload, metric: 'throughput-ops', tolerance: 0.05 }],
			measurements: [timed('throughput-ops', 94, { unitOfMeasure: 'ops/s' })]
		},
		output: {
			...latencyFinding('exceeded', { baseline: 100, measured: 94 }),
			metric: 'throughput-ops'
		}
	},
	{
		name: 'different method is incompatible',
		input: {
			...perf,
			measurements: [timed('latency-warm-ms', 10, { method: 'Single timed call.' })]
		},
		output: latencyFinding('incompatible', {
			baseline: null,
			differences: ['method description differs from the baseline']
		})
	}
];

test('Compares reviewed limits', () => {
	const grownInput = {
		measurements: [
			sizeOf('source-bytes', 18432),
			sizeOf('complexity', 38),
			sizeOf('dependencies', 6),
			sizeOf('artifact-bytes', 19000, { target: 'module' }),
			timed('latency-warm-ms', 10.5)
		]
	};
	const expected: BudgetFinding[] = [
		{ unit, metric: 'source-bytes', baseline: 18432, measured: 18432, status: 'passed' },
		{ unit, metric: 'complexity', baseline: 37, measured: 38, status: 'exceeded' },
		{ unit, metric: 'dependencies', baseline: 6, measured: 6, status: 'passed' },
		{
			unit,
			metric: 'artifact-bytes',
			target: 'module',
			baseline: 19000,
			measured: 19000,
			status: 'passed'
		},
		latencyFinding('passed', { measured: 10.5 })
	];
	const input = inputFor(grownInput);
	const output = budgetFindings(input);
	expect(output).toEqual(expected);
	expect(performanceLimit('latency-warm-ms', 10, 0.05)).toBe(10.5);
	expect(performanceLimit('throughput-ops', 100, 0.05)).toBe(95);
	recordExampleCases(recorded('compares-reviewed-limits'), [
		{
			name: 'frozen sizes and emitted size against reviewed limits',
			input,
			output
		}
	]);
});

function recordedFindings(
	cases: Array<{ name: string; input: Partial<BudgetInput>; output: BudgetFinding }>
) {
	return cases.map(({ name, input: overrides, output: expected }) => {
		const input = inputFor(overrides);
		const output = budgetFindings(input);
		expect(output).toContainEqual(expected);
		return { name, input, output };
	});
}

test('Preserves unavailable evidence', () => {
	recordExampleCases(
		recorded('preserves-unavailable-evidence'),
		recordedFindings(unavailableCases)
	);
});

test('Applies compatible performance comparisons', () => {
	recordExampleCases(
		recorded('applies-compatible-performance-comparisons'),
		recordedFindings(comparisonCases)
	);
});
