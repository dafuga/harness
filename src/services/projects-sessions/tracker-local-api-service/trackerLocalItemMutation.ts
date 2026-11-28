// @harness-uid u_g7kdpz7bel
import { randomBytes, randomUUID } from 'node:crypto';
import { dispatchLaunchSource } from '../../../repositories/projects-sessions/tracker-dispatch-repository/dispatchItemFields';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type {
	TrackerItemInput,
	TrackerItemValue
} from '../../../utils/projects-sessions/normalizeTrackerItemFields.types';
import type {
	TrackerItemAction,
	TrackerItemMutationContext,
	TrackerItemMutation,
	TrackerItemSnapshot
} from '../../../utils/projects-sessions/planTrackerItemMutation.types';
import type { TrackerLocalApiOptions } from '../TrackerLocalApiService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
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

/** Resolve the clock, duplicate candidates and launch policy used for one local write. */
export function itemMutationContext(
	store: TrackerPersistenceService,
	items: TrackerItemReadRepository,
	options: TrackerLocalApiOptions,
	explicitLaunch = false
): TrackerItemMutationContext {
	const { planLaunch, runs } = options;
	return {
		node: store.node,
		now: options.now?.() ?? Date.now(),
		timeZone: options.timeZone,
		launchNonce: randomUUID(),
		candidates: items.candidates(),
		validateModel: options.validateModel,
		planLaunch:
			planLaunch &&
			((fields, current) =>
				planLaunch(
					fields,
					current && canReplaceLaunch(store, current, runs, explicitLaunch)
						? { ...current, auto: null }
						: current,
					explicitLaunch ? 'manual' : 'automatic'
				))
	};
}

function canReplaceLaunch(
	store: TrackerPersistenceService,
	item: TrackerItemSnapshot,
	runs: TrackerLocalApiOptions['runs'],
	explicitLaunch: boolean
): boolean {
	const { id, auto } = item;
	if (!auto) return false;
	const replaceBlocked = explicitLaunch && (Boolean(item.resolved) || !item.needs_daniel);
	if (runs?.launchConsumed(id, auto, replaceBlocked)) return true;
	if (!explicitLaunch || runs?.list({ itemId: id }).some(({ auto_token }) => auto_token === auto))
		return false;
	const origin = store.database
		.prepare(`SELECT ${dispatchLaunchSource} AS source FROM items i WHERE i.id = ?`)
		.get(id) as { source: string };
	return origin.source !== 'manual';
}

export function readTrackerActor(headers: Headers): string | null {
	const actor = headers
		.get('x-tracker-as')
		?.replace(/[^\P{Cc}\u0080-\u009f]/gu, '')
		.trim()
		.slice(0, 80);
	if (!actor) return null;
	return actor;
}
