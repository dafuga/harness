import type { BudgetEvent } from '../core/budgetTypes';
import type { ComponentManifest } from '../core/unitTypes';
import { frozenMetrics, type BudgetBaseline } from './budgetFindings';
import { canonicalJson } from './canonicalJson';
import { emittedKey } from './emittedSizes';
import { emittedTargets } from './unitMeasurements';

/** One reviewed line of the ledger as a history shows it, at the commit whose record it cites. */
export interface BudgetReview {
	type: BudgetEvent['type'];
	/** The commit that was measured, which is where the size was what the review accepted. */
	commit: string;
	record: string;
	reviewer: string;
	reason: string;
	at: string;
	/** The limits the unit had before an approval; a baseline had none. */
	before?: Record<string, number>;
	after: Record<string, number>;
	unmeasured?: Record<string, string>;
}

/** The limits one revision freezes for what a unit emits, by execution target. */
export interface EmittedLimits {
	limits: Record<string, number>;
	/** Targets whose output could not be built when the limits were reviewed, each with why. */
	unmeasured?: Record<string, string>;
}

function review(event: BudgetEvent): BudgetReview {
	const { type, reviewer, reason, at, unmeasured } = event;
	const changed =
		event.type === 'approval'
			? { before: event.before, after: event.after }
			: { after: event.metrics };
	const stated = unmeasured ? { unmeasured } : {};
	const cited = { commit: event.record.commit, record: event.record.id };
	return { type, ...cited, reviewer, reason, at, ...changed, ...stated };
}

/**
 * The reviews of every unit, in the order the ledgers hold them. Several revisions carry the
 * same lines; each review is kept once.
 */
export function budgetReviews(ledgers: BudgetEvent[][]): Map<string, BudgetReview[]> {
	const seen = new Set<string>();
	const units = new Map<string, BudgetReview[]>();
	for (const event of ledgers.flat()) {
		const key = canonicalJson(event);
		if (seen.has(key)) continue;
		seen.add(key);
		units.set(event.unit, [...(units.get(event.unit) ?? []), review(event)]);
	}
	for (const reviews of units.values())
		reviews.sort((left, right) => (left.at < right.at ? -1 : 1));
	return units;
}

/** The limits a revision holds for the source of a unit, by metric. */
export interface FrozenLimits {
	metrics: Record<string, number>;
	unmeasured?: Record<string, string>;
}

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
