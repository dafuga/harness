// @harness-uid u_c5mwmd6z6z

/** @pure True while Daniel can already see an unanswered flag on the item. */
export function hasPublishedAsk(
	item: { needs_daniel?: unknown; resolved?: unknown } | undefined
): boolean {
	return Boolean(item?.needs_daniel) && !item?.resolved;
}
