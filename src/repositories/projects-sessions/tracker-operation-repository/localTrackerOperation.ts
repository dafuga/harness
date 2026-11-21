// @harness-uid u_c5mwmd6z6z
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import { nextTrackerClock } from '../../../utils/projects-sessions/nextTrackerClock';
import type { TrackerLocalOperation, TrackerOperation } from '../TrackerOperationRepository.types';

export function localTrackerOperation(
	database: SqliteDatabase,
	request: TrackerLocalOperation,
	now: number
): TrackerOperation {
	const { node, itemId, fields } = request;
	if (!node || /\s/.test(node)) throw new TypeError('Tracker node name is required');
	const { hlc: floor } = database.prepare('SELECT max(hlc) AS hlc FROM ops').get() as {
		hlc: string | null;
	};
	const hlc = nextTrackerClock(node, now, floor);
	const actor = operationActor(request.actor);
	return { op_id: hlc, item_id: itemId, fields, hlc, node, ...(actor ? { actor } : {}) };
}

export function operationActor(actor: string | null | undefined): string | null {
	if (actor == null) return null;
	// eslint-disable-next-line no-control-regex -- The Tracker actor field excludes ASCII control characters.
	const printable = String(actor).replace(/[\x00-\x1f\x7f]/g, '');
	return printable.trim().slice(0, 80) || null;
}
