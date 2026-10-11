import type { Comparison } from '../core/comparisonTypes';
import type { RuntimeKind } from '../core/unitTypes';
import type { BudgetFinding } from '../core/verificationTypes';
import { comparisonDifferences } from './comparisonDifferences';

export const frozenMetrics = ['source-bytes', 'complexity', 'dependencies'] as const;
/** Metrics where a larger value is better; every other metric is better when smaller. */
const higherIsBetter = new Set(['throughput-ops']);

/** What a value means: its unit, how it was taken and the exact context it was taken in. */
interface Definition {
	unitOfMeasure?: string;
	method?: string;
	comparison?: Comparison;
}

/** A frozen value with its definition; without the definition it compares with nothing. */
export interface PerformanceBaseline extends Definition {
	workload: string;
	metric: string;
	target: RuntimeKind;
	profile: string;
	value: number;
}

export interface BudgetBaseline {
	metrics: Record<string, number>;
	/** Frozen metrics that had no value when the limits were reviewed, each with the reason. */
	unmeasured?: Record<string, string>;
	performance: PerformanceBaseline[];
}

interface Measured extends Definition {
	unit: string;
	metric: string;
	value: number | null;
	/** Why there is no value; without it a missing value is a measurement that was not taken. */
	unavailable?: string;
	/** What a value leaves out. */
	partial?: string;
	workload: string | null;
	profile: string | null;
	target?: RuntimeKind;
}

export interface BudgetInput {
	unit: string;
	/** Machine profile of this run; performance compares only within it. */
	profile: string;
	defaultTarget: RuntimeKind;
	budgets: Array<{ workload: string; metric: string; tolerance: number; target?: RuntimeKind }>;
	measurements: Measured[];
	baseline: BudgetBaseline | undefined;
	/** Size and complexity are checked for units whose source changed. */
	checkSize: boolean;
}

/** Judges one unit: frozen size and complexity, and performance within its exact tolerance. */
export function budgetFindings(input: BudgetInput): BudgetFinding[] {
	const mine = input.measurements.filter((item) => item.unit === input.unit);
	const own = mine.filter((item) => item.value !== null);
	const sizes = input.checkSize
		? frozenMetrics.map((metric) => sizeFinding(input, mine, metric))
		: [];
	return [...sizes, ...input.budgets.map((budget) => performanceFinding(input, own, budget))];
}

function sizeFinding(input: BudgetInput, mine: Measured[], metric: string): BudgetFinding {
	const found = mine.find((item) => item.metric === metric);
	const measured = found?.value ?? null;
	const baseline = input.baseline?.metrics[metric] ?? null;
	const base = { unit: input.unit, metric, baseline, measured };
	if (measured === null) return { ...base, ...unmeasured(input, metric, found?.unavailable) };
	if (baseline === null) return { ...base, ...unlimited(input, metric) };
	return { ...base, ...limited(measured, baseline, found?.partial) };
}

/** A value against its limit; a value that leaves something out says so beside the verdict. */
function limited(
	measured: number,
	baseline: number,
	partial: string | undefined
): Pick<BudgetFinding, 'status' | 'detail'> {
	const status = measured > baseline ? 'exceeded' : 'passed';
	return partial ? { status, detail: partial } : { status };
}

/** A value without a limit. It may be one that could not be measured when limits were reviewed. */
function unlimited(input: BudgetInput, metric: string): Pick<BudgetFinding, 'status' | 'detail'> {
	const became = input.baseline?.unmeasured?.[metric] ? { detail: 'measurable-now' } : {};
	return { status: 'missing-baseline', ...became };
}

/**
 * A frozen metric without a value. When the measurer says why and the reviewed baseline already
 * recorded that it could not be measured, that is stated and not judged. A value that existed at
 * the baseline and is gone, or one nobody explains, is a missing measurement and never passes.
 */
function unmeasured(
	input: BudgetInput,
	metric: string,
	reason: string | undefined
): Pick<BudgetFinding, 'status' | 'detail'> {
	if (!reason) return { status: 'missing-measurement' };
	if (!input.baseline) return { status: 'missing-baseline', detail: reason };
	if (input.baseline.unmeasured?.[metric]) return { status: 'unavailable', detail: reason };
	return { status: 'missing-measurement', detail: reason };
}

function performanceFinding(
	input: BudgetInput,
	own: Measured[],
	budget: BudgetInput['budgets'][number]
): BudgetFinding {
	const target = budget.target ?? input.defaultTarget;
	const same = (item: { workload: string | null; metric: string; target?: RuntimeKind }) =>
		item.workload === budget.workload && item.metric === budget.metric && item.target === target;
	const here = <Item extends { profile: string | null }>(items: Item[]) =>
		items.find((item) => item.profile === input.profile);
	const measured = here(own.filter(same));
	const recorded = (input.baseline?.performance ?? []).filter(same);
	const baseline = here(recorded);
	const finding = {
		unit: input.unit,
		metric: budget.metric,
		baseline: baseline ? baseline.value : null,
		measured: measured ? measured.value : null,
		detail: `${budget.workload} on the ${target} target`
	};
	if (!measured) return { ...finding, status: 'missing-measurement' };
	if (baseline) return { ...finding, ...compared(budget, measured, baseline) };
	return { ...finding, status: recorded.length > 0 ? 'incompatible' : 'missing-baseline' };
}

/**
 * A value is judged only against a baseline with the identical definition: unit, method,
 * request, boundary, protocol and sampling. Anything else is reported, never compared.
 */
function compared(
	budget: { metric: string; tolerance: number },
	measured: Measured,
	baseline: PerformanceBaseline
): Pick<BudgetFinding, 'status' | 'baseline' | 'differences'> {
	const verdict = comparisonDifferences(budget.metric, measured, baseline);
	if (verdict.status !== 'comparable') {
		return { status: verdict.status, baseline: null, differences: verdict.differences };
	}
	const exceeded = worse(budget, measured.value ?? 0, baseline.value);
	return { status: exceeded ? 'exceeded' : 'passed', baseline: baseline.value };
}

/** The limit is exact: the baseline moved by the tolerance in the direction that is worse. */
export function performanceLimit(metric: string, baseline: number, tolerance: number): number {
	const factor = higherIsBetter.has(metric) ? 1 - tolerance : 1 + tolerance;
	return Number((baseline * factor).toPrecision(12));
}

function worse(budget: { metric: string; tolerance: number }, measured: number, baseline: number) {
	const limit = performanceLimit(budget.metric, baseline, budget.tolerance);
	return higherIsBetter.has(budget.metric) ? measured < limit : measured > limit;
}
