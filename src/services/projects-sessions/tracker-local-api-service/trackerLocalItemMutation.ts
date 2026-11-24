// @harness-uid u_g7kdpz7bel
import { createHash, randomBytes } from 'node:crypto';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerItemRow } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { planTrackerItemMutation } from '../../../utils/projects-sessions/planTrackerItemMutation';
import type {
	TrackerItemInput,
	TrackerItemValue
} from '../../../utils/projects-sessions/normalizeTrackerItemFields.types';
import type {
	TrackerItemAction,
	TrackerItemMutationContext,
	TrackerItemMutationPlan,
	TrackerItemMutation
} from '../../../utils/projects-sessions/planTrackerItemMutation.types';
import type { TrackerInboxReview } from './trackerLocalItemMutation.types';
import { trackerItemTransitions } from '../../../utils/projects-sessions/trackerItemTransitions';

import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';

const maxBodyBytes = 1024 * 1024;
const itemAlphabet = '0123456789abcdefghjkmnpqrstvwxyz';

export function itemMutation(
	action: TrackerItemAction | 'add',
	id: string,
	body: TrackerItemInput,
	items: TrackerItemReadRepository
): TrackerItemMutation {
	return action === 'add'
		? { action, itemId: newItemId(), body }
		: { action, item: items.resolve(id), body };
}

export function trackerMutationBody(
	body: TrackerItemInput,
	action: TrackerItemAction | 'add' | undefined,
	actor: string | null,
	canLaunch: boolean
): TrackerItemInput {
	if ((action === 'park' || action === 'move-on') && !isDaniel(actor))
		throw trackerItemError('only Daniel can park or close a next step', 403);
	if (action !== 'add' || !canLaunch || !isDanielOrChief(actor)) return body;
	if (body.later || body.auto !== undefined || !launchableCreation(body)) return body;
	return { ...body, auto: true };
}

function isDanielOrChief(actor: string | null) {
	return isDaniel(actor) || /^(?:cos|chief[-_ ]of[-_ ]staff)$/i.test(actorName(actor));
}

function isDaniel(actor: string | null) {
	return /^(?:daniel(?: fugere)?|danielfugere)$/i.test(actorName(actor));
}

function actorName(actor: string | null) {
	return actor?.split('@')[0]?.trim() ?? '';
}

function launchableCreation(body: TrackerItemInput) {
	return (
		(body.kind ?? 'task') === 'task' &&
		!body.every &&
		![body.flag, body.question, body.needs_daniel, body.next_step].some(Boolean) &&
		(!body.status || body.status === 'open' || body.status === 'in_progress')
	);
}

export function itemAction(
	method: string,
	id: string | undefined,
	verb: string | undefined
): TrackerItemAction | 'add' | undefined {
	if (verb) {
		if (method !== 'POST' || verb === 'remove') return undefined;
		return Object.hasOwn(trackerItemTransitions, verb) ? (verb as TrackerItemAction) : undefined;
	}
	if (!id) return method === 'POST' ? 'add' : undefined;
	if (method === 'PATCH') return 'update';
	return method === 'DELETE' ? 'remove' : undefined;
}

function newItemId(): string {
	return Array.from(randomBytes(10), (byte) => itemAlphabet[byte & 31]).join('');
}

export const trackerSessionItemPrefix = 'harness_tracker_session_item:';

export function recordTrackerSessionItem(
	database: SqliteDatabase,
	itemId: string,
	sessionRun: TrackerItemValue
): void {
	if (typeof sessionRun !== 'string' || !/^[1-9][0-9]{0,15}$/.test(sessionRun)) return;
	const id = Number(sessionRun);
	if (!Number.isSafeInteger(id)) return;
	if (!database.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'runs'").get())
		return;
	database
		.prepare(
			`INSERT OR IGNORE INTO meta(k, v)
		SELECT ?, ? FROM runs WHERE id = ? AND item_id <> ? AND tmux GLOB 'auto-*-r*'`
		)
		.run(`${trackerSessionItemPrefix}${id}:${itemId}`, itemId, id, itemId);
}

export async function readItemBody(
	request: Request,
	maximum: number = maxBodyBytes
): Promise<TrackerItemInput> {
	if (!request.body) return {};
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		for (let part = await reader.read(); !part.done; part = await reader.read()) {
			size += part.value.byteLength;
			if (size > maximum) {
				void reader.cancel().catch(() => {});
				throw trackerItemError('body too large', 413);
			}
			chunks.push(part.value);
		}
	} finally {
		reader.releaseLock();
	}
	return size ? parseItemBody(Buffer.concat(chunks, size).toString('utf8')) : {};
}

function parseItemBody(text: string): TrackerItemInput {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		throw trackerItemError('invalid JSON body');
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw trackerItemError('JSON body must be an object');
	}
	return value as TrackerItemInput;
}

/** The inbox reviews exact, visible items. Clock changes detect even an identical replacement question. */
export function readInboxItem(database: SqliteDatabase, id: string): TrackerInboxReview {
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

export function planInboxWrite(
	review: TrackerInboxReview,
	draft: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemMutationPlan {
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
