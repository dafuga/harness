// @harness-uid u_g7kdpz7bel
import { createHash } from 'node:crypto';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type { TrackerItemRow } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type {
	TrackerItemInput,
	TrackerItemValue
} from '../../../utils/projects-sessions/normalizeTrackerItemFields.types';
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
	ports: TrackerInboxRoute
): Promise<TrackerInboxResult> {
	const { store, items, options, actor } = ports;
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

const inboxTextField = { note: 'text', flag: 'question', answer: 'answer' } as const;

function planInboxWrite(
	review: TrackerInboxReview,
	draft: TrackerItemInput,
	context: TrackerItemMutationContext
) {
	const { action } = draft;
	if (action !== 'note' && action !== 'flag' && action !== 'answer')
		throw trackerItemError('invalid inbox action');
	const chosen = action === 'answer' && draft.option !== undefined;
	const body = chosen
		? { option: inboxOption(draft.option), confirmed: draft.confirmed === true }
		: { [inboxTextField[action]]: inboxWriteText(draft.text) };
	if (action !== 'note') requireReviewedFlag(review, action, draft.revision);
	return planTrackerItemMutation({ action, item: review.item, body }, context);
}

/** A tapped option is its 1-based number; the Store checks it against the ask's own options. */
function inboxOption(input: TrackerItemValue): number {
	if (typeof input !== 'number' || !Number.isInteger(input) || input < 1 || input > 4)
		throw trackerItemError('invalid inbox option');
	return input;
}

function inboxWriteText(input: TrackerItemValue): string {
	const text = typeof input === 'string' ? input.trim() : '';
	if (!text || Buffer.byteLength(text) > 512) throw trackerItemError('invalid inbox write text');
	return text;
}

function requireReviewedFlag(
	{ item, revision }: TrackerInboxReview,
	action: 'flag' | 'answer',
	reviewed: TrackerItemValue
) {
	const open = Boolean(item.needs_daniel && !item.resolved);
	if (revision !== reviewed || open !== (action === 'answer')) throw staleReview();
}

function staleReview() {
	return Object.assign(trackerItemError('Tracker attention changed', 409), {
		body: { code: 'staleReview' }
	});
}
