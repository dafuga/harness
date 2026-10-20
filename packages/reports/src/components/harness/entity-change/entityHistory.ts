import type { HarnessReview } from '../../../models/HarnessBudget.types';
import { humanize } from '../../../utils/entityContract';
import { emittedLabel } from '../../../utils/harnessEmitted';

const emitted = 'artifact-bytes:';

const named = (key: string) =>
	key.startsWith(emitted)
		? `emitted size (${emittedLabel(key.slice(emitted.length))})`
		: humanize(key);

/** What a review froze, in words: each limit, or what it was and what it became. */
export function reviewChanges(review: HarnessReview): string[] {
	return Object.entries(review.after).map(([key, after]) => {
		const before = review.before?.[key];
		return before === undefined ? `${named(key)} ${after}` : `${named(key)} ${before} → ${after}`;
	});
}
