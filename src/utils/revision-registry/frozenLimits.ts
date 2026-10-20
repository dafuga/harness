import type { FrozenLimits, EmittedLimits } from '../budgetReviews';
import type { ComponentManifest } from '../../core/unitTypes';
import { frozenMetrics, type BudgetBaseline } from '../budgetFindings';
import { emittedKey } from '../emittedSizes';
import { emittedTargets } from '../unitMeasurements';

/**
 * What a revision's ledger holds for the size, complexity and dependencies of one unit: the
 * reviewed numbers, and the reason for a metric that could not be measured at review. Undefined
 * for a unit without a baseline there: a declared freeze alone is not a limit.
 */
export function frozenLimits(baseline: BudgetBaseline | undefined): FrozenLimits | undefined {
	if (!baseline) return undefined;
	const picked = <Value>(from: Record<string, Value> | undefined) =>
		Object.fromEntries(
			frozenMetrics.flatMap((metric) => (from && metric in from ? [[metric, from[metric]]] : []))
		) as Record<string, Value>;
	const unmeasured = picked(baseline.unmeasured);
	const stated = Object.keys(unmeasured).length > 0 ? { unmeasured } : {};
	return { metrics: picked(baseline.metrics), ...stated };
}

/**
 * What a revision freezes for the outputs of one unit: a limit for each target that has one, and
 * the reason for each target that could not be built at review. Undefined for a unit that emits
 * nothing; a target named in neither part has no limit at that revision.
 */
export function emittedLimits(
	unit: ComponentManifest,
	baseline: BudgetBaseline | undefined
): EmittedLimits | undefined {
	const kinds = [...new Set(emittedTargets(unit).map((target) => target.kind))];
	if (kinds.length === 0) return undefined;
	const picked = <Value>(from: Record<string, Value> | undefined) =>
		Object.fromEntries(
			kinds.flatMap((kind) => {
				const value = from?.[emittedKey(kind)];
				return value === undefined ? [] : [[kind, value]];
			})
		) as Record<string, Value>;
	const unmeasured = picked(baseline?.unmeasured);
	const stated = Object.keys(unmeasured).length > 0 ? { unmeasured } : {};
	return { limits: picked(baseline?.metrics), ...stated };
}
