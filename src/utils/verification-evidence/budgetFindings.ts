import { emittedMetric } from '../development-tooling/emittedSizes';

export const frozenMetrics = ['source-bytes', 'complexity', 'dependencies'] as const;

/** True for every metric whose limit is a frozen number, whatever name it is frozen under. */
export const isFrozen = (metric: string): boolean =>
	(frozenMetrics as readonly string[]).includes(metric) || metric.startsWith(emittedMetric);

export /** Metrics where a larger value is better; every other metric is better when smaller. */
const higherIsBetter = new Set(['throughput-ops']);

/** The limit is exact: the baseline moved by the tolerance in the direction that is worse. */
export function performanceLimit(metric: string, baseline: number, tolerance: number): number {
	const factor = higherIsBetter.has(metric) ? 1 - tolerance : 1 + tolerance;
	return Number((baseline * factor).toPrecision(12));
}

export { budgetFindings } from '../../services/verification-evidence/budget-service/budgetFindings';

export type {
	PerformanceBaseline,
	BudgetBaseline,
	Measured,
	BudgetInput
} from './budgetFindings.types';
