// @harness-uid u_4pgfvaopdt
import type { TrackerItemSnapshot } from './planTrackerItemMutation.types';

/** @pure The unanswered question on an item, including one still under review. */
export function trackerOpenDecision(item: TrackerItemSnapshot) {
	if (item.chief_review) {
		const { fields } = JSON.parse(item.chief_review) as { fields: Record<string, unknown> };
		if (fields.needs_daniel) return { question: String(fields.question ?? '') };
	}
	return item.needs_daniel && !item.resolved ? { question: item.question } : undefined;
}
