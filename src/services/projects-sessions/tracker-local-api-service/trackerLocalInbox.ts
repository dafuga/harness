// @harness-uid u_g7kdpz7bel
import { createHash } from 'node:crypto';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type { TrackerItemRow } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerItemInput } from '../../../utils/projects-sessions/normalizeTrackerItemFields.types';
import { planTrackerItemMutation } from '../../../utils/projects-sessions/planTrackerItemMutation';
import type { TrackerItemMutationContext } from '../../../utils/projects-sessions/planTrackerItemMutation.types';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import { itemMutationContext, readItemBody } from './trackerLocalItemMutation';
import type {
	TrackerInboxReview,
	TrackerInboxRoute,
	TrackerInboxResult
} from './trackerLocalInbox.types';

/** Read a decision or commit its reviewed action under the Tracker journal's writer lock. */
export async function trackerInboxItem(
	request: Request,
	id: string,
	{ store, items, options, actor }: TrackerInboxRoute
): Promise<TrackerInboxResult> {
	if (request.method === 'GET') {
		const { revision, flaggedAt } = readInboxItem(store.database, id);
		const runs = options.runs?.list({ itemId: id }).slice(-5).reverse() ?? [];
		return { item: items.getStored(id), revision, flaggedAt, runs };
	}
	if (request.method !== 'POST') throw trackerItemError('method not allowed', 405);
	const body = await readItemBody(request, 4096);
	request.signal.throwIfAborted();
	return store.commitLocal(() => ({
		result: { status: 'accepted' },
		operation: {
			...planInboxWrite(
				readInboxItem(store.database, id),
				body,
				itemMutationContext(store, items, options)
			),
			actor
		}
	}));
}

/** The inbox reviews exact, visible items. Clock changes detect even an identical replacement question. */
function readInboxItem(database: SqliteDatabase, id: string): TrackerInboxReview {
	const item = database
		.prepare(
			'SELECT * FROM items WHERE id = ? AND deleted = 0 AND coalesce(sensitive, 0) = 0 AND title IS NOT NULL'
		)
		.get(id) as (TrackerItemRow & { clocks: string }) | undefined;
	if (!item) throw trackerItemError('Tracker item unavailable', 404);
	const { question, needs_daniel, resolved, answered_at, answer } = JSON.parse(
		item.clocks
	) as Record<string, string>;
	const revision = createHash('sha256')
		.update(
			JSON.stringify([
				id,
				question,
				needs_daniel,
				resolved,
				answered_at,
				answer,
				item.question,
				item.needs_daniel,
				item.resolved,
				item.answered_at,
				item.answer
			])
		)
		.digest('hex');
	const clock = /^(\d{15})-/.exec(question ?? needs_daniel ?? '');
	return { item, revision, flaggedAt: clock ? new Date(Number(clock[1])).toISOString() : null };
}

function planInboxWrite(
	review: TrackerInboxReview,
	draft: TrackerItemInput,
	context: TrackerItemMutationContext
) {
	const { item, revision } = review;
	const { action, text, revision: reviewed } = draft;
	if (action !== 'note' && action !== 'flag' && action !== 'answer')
		throw trackerItemError('invalid inbox action');
	if (typeof text !== 'string' || !text.trim() || Buffer.byteLength(text.trim()) > 512)
		throw trackerItemError('invalid inbox write text');
	if (action !== 'note' && revision !== reviewed) throw staleReview();
	const open = item.needs_daniel && !item.resolved;
	if ((action === 'answer' && !open) || (action === 'flag' && open)) throw staleReview();
	const value = text.trim();
	const body =
		action === 'note'
			? { text: value }
			: action === 'flag'
				? { question: value }
				: { answer: value, by: 'daniel' };
	return planTrackerItemMutation({ action, item, body }, context);
}

function staleReview() {
	return Object.assign(trackerItemError('Tracker attention changed', 409), {
		body: { code: 'staleReview' }
	});
}
