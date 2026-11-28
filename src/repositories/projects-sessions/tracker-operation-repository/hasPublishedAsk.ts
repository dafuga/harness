// @harness-uid u_c5mwmd6z6z
import type { PublishedAskColumns } from './chiefReviewFields.types';

/** @pure True while Daniel can already see an unanswered flag on the item. */
export function hasPublishedAsk(item: PublishedAskColumns | undefined): boolean {
	return Boolean(item?.needs_daniel) && !item?.resolved;
}
