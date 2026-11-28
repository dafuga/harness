// @harness-uid u_bl6xl2h4a3
import type { TrackerNotificationItem } from '../TrackerNotificationService.types';

/**
 * A held ask and a private Chief of Staff answer notify nobody. Finishing the item still does,
 * and so does everything that happens after the answer.
 */
export function isHiddenByReview(
	item: Pick<TrackerNotificationItem, 'chief_review'>,
	fields: Readonly<Record<string, unknown>>,
	finished: boolean
): boolean {
	if (fields.chief_answer) return true;
	const held = Boolean(item.chief_review) || typeof fields.chief_review === 'string';
	return !finished && held;
}
