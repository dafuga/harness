import { BudgetReview } from '../../utils/budgetReviews';
import type { BudgetEvent } from "../../core/budgetTypes";
import { canonicalJson } from "../../utils/canonicalJson";

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
