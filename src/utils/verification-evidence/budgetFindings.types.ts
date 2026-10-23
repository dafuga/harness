import type { Comparison } from '../../core/development-tooling/comparisonTypes';
import type { RuntimeKind } from '../../core/development-tooling/unitTypes';

/** What a value means: its unit, how it was taken and the exact context it was taken in. */
export interface Definition {
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
