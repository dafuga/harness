// @harness-uid u_bl6xl2h4a3
import {
	chiefReviewFields,
	readChiefReview
} from '../../../repositories/projects-sessions/tracker-operation-repository/chiefReviewFields';
import { localTrackerOperation } from '../../../repositories/projects-sessions/tracker-operation-repository/localTrackerOperation';
import type { ChiefReviewRow } from '../../../repositories/projects-sessions/tracker-operation-repository/chiefReviewFields.types';
import { isTrackerBlockedOnDaniel } from '../../../utils/projects-sessions/isTrackerBlockedOnDaniel';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { chiefReviewEmergency } from './trackerCosDelivery';
import { cosSendWindowStart } from './trackerCosWindow';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';

export function trackerChiefReviewAlerts(store: TrackerPersistenceService): TrackerWatchdogAlert[] {
	const rows = store.database
		.prepare(
			`SELECT id, title, chief_review, priority, sensitive FROM items
		WHERE deleted = 0 AND status <> 'ignored' AND chief_review IS NOT NULL`
		)
		.all() as ChiefReviewRow[];
	return rows.flatMap((row) => {
		const review = readChiefReview(row.chief_review);
		if (!review || review.mode === 'approved') return [];
		const emergency = chiefReviewEmergency(
			'',
			String(review.fields.question ?? review.fields.blocked_reason ?? '')
		);
		const kind = emergency
			? 'chief-review-emergency'
			: review.mode === 'chief-only'
				? 'chief-only-review'
				: 'chief-review';
		return [
			{
				id: `chief-review:${row.id}:${review.generation}`,
				item_id: row.id,
				host: store.node,
				at: review.at,
				kind,
				identity: review.generation,
				reason: `Awaiting your review. Read with tracker review ${row.id} --by "Chief of Staff"${review.mode === 'chief-only' ? ' and resolve it there.' : ', then answer or release.'}`
			}
		];
	});
}

export function publishApprovedReviews(store: TrackerPersistenceService, now: number): void {
	if (cosSendWindowStart(now) === null) return;
	const query = store.database.prepare(
		`SELECT id, chief_review FROM items WHERE deleted = 0 AND status <> 'ignored'
		AND json_extract(chief_review, '$.mode') = 'approved'`
	);
	for (const row of query.all() as Pick<ChiefReviewRow, 'id' | 'chief_review'>[]) {
		store.commitLocal(() => {
			const current = store.database
				.prepare('SELECT chief_review FROM items WHERE id = ? AND deleted = 0')
				.get(row.id) as { chief_review: string | null } | undefined;
			const review = readChiefReview(current?.chief_review);
			if (review?.mode !== 'approved' || current?.chief_review !== row.chief_review)
				return { result: false };
			return {
				result: true,
				operation: {
					itemId: row.id,
					actor: review.actor,
					fields: { ...review.fields, chief_review: null, chief_answer: null }
				}
			};
		});
	}
}

/** Move legacy open flags and Daniel blockers into the review queue before starting delivery. */
export function migrateTrackerChiefReviews(store: TrackerPersistenceService): void {
	if (store.getMeta('chief_review_migrated') !== null) return;
	const flag = 'needs_daniel = 1 AND resolved = 0';
	const rows = store.database
		.prepare(
			`SELECT id FROM items WHERE deleted = 0 AND title IS NOT NULL AND
		chief_review IS NULL AND ((${flag}) OR (status = 'blocked' AND blocked_reason IS NOT NULL))`
		)
		.all() as { id: string }[];
	for (const { id } of rows) {
		store.commitLocal(() => {
			const row = legacyAskFields(store, id);
			if (!row) return { result: false };
			const { source_actor, ...fields } = row;
			const actor = typeof source_actor === 'string' ? source_actor : null;
			const operation = localTrackerOperation(
				store.database,
				{ itemId: id, node: store.node, fields, actor },
				store.now()
			);
			return {
				result: true,
				operation: { itemId: id, fields: chiefReviewFields(operation, true) }
			};
		});
	}
	store.writeMeta({ chief_review_migrated: '1' });
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
	const blocker =
		row?.status === 'blocked' && isTrackerBlockedOnDaniel(String(row.blocked_reason ?? ''));
	const flagged = row?.needs_daniel === 1 && row?.resolved === 0;
	if (row && (flagged || blocker)) return row;
	return null;
}
