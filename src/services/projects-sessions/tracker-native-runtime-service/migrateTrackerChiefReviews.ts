// @harness-uid u_bl6xl2h4a3
import { chiefReviewFields } from '../../../repositories/projects-sessions/tracker-operation-repository/chiefReviewFields';
import { localTrackerOperation } from '../../../repositories/projects-sessions/tracker-operation-repository/localTrackerOperation';
import { isTrackerBlockedOnDaniel } from '../../../utils/projects-sessions/isTrackerBlockedOnDaniel';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';

const migratedKey = 'chief_review_migrated';
/** Context for classifying an ask. The migration never rewrites these. */
const contextFields = ['status', 'title', 'resolved'];

/** Move open flags and waiting-on-Daniel blocks into the review queue before delivery starts. */
export function migrateTrackerChiefReviews(store: TrackerPersistenceService): void {
	if (store.getMeta(migratedKey) !== null) return;
	const rows = store.database
		.prepare(
			`SELECT id FROM items WHERE deleted = 0 AND title IS NOT NULL AND chief_review IS NULL
			AND ((needs_daniel = 1 AND resolved = 0) OR (status = 'blocked' AND blocked_reason IS NOT NULL))`
		)
		.all() as { id: string }[];
	for (const { id } of rows) holdLegacyAsk(store, id);
	store.writeMeta({ [migratedKey]: '1' });
}

function holdLegacyAsk(store: TrackerPersistenceService, id: string) {
	store.commitLocal(() => {
		const row = legacyAskFields(store, id);
		if (!row) return { result: false };
		const { source_actor, ...fields } = row;
		const actor = typeof source_actor === 'string' ? source_actor : null;
		const draft = { itemId: id, node: store.node, fields, actor };
		const operation = localTrackerOperation(store.database, draft, store.now());
		const held = Object.fromEntries(
			Object.entries(chiefReviewFields(operation, { migrate: true })).filter(
				([field]) => !contextFields.includes(field)
			)
		);
		return { result: true, operation: { itemId: id, fields: held } };
	});
}

function legacyAskFields(store: TrackerPersistenceService, id: string) {
	const row = store.database
		.prepare(
			`SELECT needs_daniel, resolved, status, title, question, options, confirm, attachments, attachment_docs,
			next_step, blocked_reason,
			(SELECT actor FROM ops WHERE op_id = coalesce(json_extract(items.clocks, '$.question'),
				json_extract(items.clocks, '$.blocked_reason'))) AS source_actor
		FROM items WHERE id = ? AND deleted = 0 AND chief_review IS NULL`
		)
		.get(id) as Record<string, unknown> | undefined;
	if (!row) return null;
	const blocker =
		row.status === 'blocked' && isTrackerBlockedOnDaniel(String(row.blocked_reason ?? ''));
	const flagged = row.needs_daniel === 1 && row.resolved === 0;
	if (!blocker) delete row.blocked_reason;
	return blocker || flagged ? row : null;
}
