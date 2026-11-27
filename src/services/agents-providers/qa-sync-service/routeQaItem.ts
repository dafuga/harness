// @harness-uid u_4tnqr7ckfn
import type { QaTrackerItem } from '../../../core/agents-providers/qaSync.types';
import type { QaRoute } from './routeQaItem.types';

/**
 * @pure An item owns an issue when its title names that issue and no other. Exactly one owner
 * gets the note; anything else, including batch items, goes to the inbox with the related ids.
 */
export function routeQaItem(
	items: readonly QaTrackerItem[],
	issue: number,
	inboxItem: string
): QaRoute {
	const related = items
		.filter((item) => item.id !== inboxItem)
		.map((item) => ({ id: item.id, issues: namedIssues(item.title) }))
		.filter((item) => item.issues.has(issue));
	const owners = related.filter((item) => item.issues.size === 1);
	if (owners.length === 1) return { item: owners[0].id, routing: [] };
	const reason = owners.length
		? `several open items own #${issue}`
		: `no open item is only about #${issue}`;
	const ids = related.map((item) => item.id).join(', ');
	return {
		item: inboxItem,
		routing: [`Sent to the inbox: ${reason}.${ids ? ` Related items: ${ids}.` : ''}`]
	};
}

function namedIssues(title: string): Set<number> {
	return new Set([...title.matchAll(/(?:#|\/issues\/)(\d{1,9})(?!\d)/g)].map((m) => Number(m[1])));
}
