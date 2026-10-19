import type { Comparison } from "../core/comparisonTypes";
import type { RuntimeKind } from "../core/unitTypes";
import { emittedMetric } from "./emittedSizes";

export const frozenMetrics = ['source-bytes', 'complexity', 'dependencies'] as const;

/** True for every metric whose limit is a frozen number, whatever name it is frozen under. */
export const isFrozen = (metric: string): boolean =>
	(frozenMetrics as readonly string[]).includes(metric) || metric.startsWith(emittedMetric);

export /** Metrics where a larger value is better; every other metric is better when smaller. */
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

export interface Measured extends Definition {
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

/** The limit is exact: the baseline moved by the tolerance in the direction that is worse. */
export function performanceLimit(metric: string, baseline: number, tolerance: number): number {
	const factor = higherIsBetter.has(metric) ? 1 - tolerance : 1 + tolerance;
	return Number((baseline * factor).toPrecision(12));
}

export { budgetFindings } from '../services/budget-service/budgetFindings';
