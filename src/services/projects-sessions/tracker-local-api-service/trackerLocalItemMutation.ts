// @harness-uid u_g7kdpz7bel
import { randomBytes } from 'node:crypto';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type {
	TrackerItemInput,
	TrackerItemValue
} from '../../../utils/projects-sessions/normalizeTrackerItemFields.types';
import type {
	TrackerItemAction,
	TrackerItemMutation
} from '../../../utils/projects-sessions/planTrackerItemMutation.types';
import { trackerItemTransitions } from '../../../utils/projects-sessions/trackerItemTransitions';

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
