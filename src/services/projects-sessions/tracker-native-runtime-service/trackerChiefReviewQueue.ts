// @harness-uid u_bl6xl2h4a3
import { readChiefReview } from '../../../repositories/projects-sessions/tracker-operation-repository/chiefReviewFields';
import type {
	ChiefReview,
	ChiefReviewRow
} from '../../../repositories/projects-sessions/tracker-operation-repository/chiefReviewFields.types';
import { cosSendWindowStart } from '../../../utils/projects-sessions/trackerCosSendWindow';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { chiefReviewEmergency } from './trackerCosDelivery';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';

/** Every held ask, as an alert for the Chief of Staff channel. It never carries the question. */
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
		return [
			{
				id: `chief-review:${row.id}:${review.generation}`,
				item_id: row.id,
				host: store.node,
				at: review.at,
				kind: reviewKind(review),
				identity: review.generation,
				reason: reviewInstruction(row.id, review)
			}
		];
	});
}

function reviewKind({ mode, fields }: ChiefReview) {
	const text = String(fields.question ?? fields.blocked_reason ?? '');
	if (chiefReviewEmergency('', text)) return 'chief-review-emergency';
	return mode === 'chief-only' ? 'chief-only-review' : 'chief-review';
}

function reviewInstruction(id: string, { mode }: ChiefReview) {
	const next =
		mode === 'chief-only'
			? 'This is Tracker plumbing: resolve it there.'
			: 'Then answer it, or release it to Daniel.';
	return `Awaiting your review. Read with tracker review ${id} --by "Chief of Staff". ${next}`;
}

/** Publish what Chief of Staff or Daniel raised during the night hold. */
export function publishApprovedReviews(store: TrackerPersistenceService, now: number): void {
	if (cosSendWindowStart(now) === null) return;
	const query = store.database.prepare(
		`SELECT id, chief_review FROM items WHERE deleted = 0 AND status <> 'ignored'
		AND json_extract(chief_review, '$.mode') = 'approved'`
	);
	for (const row of query.all() as Pick<ChiefReviewRow, 'id' | 'chief_review'>[])
		publishReview(store, row);
}

function publishReview(
	store: TrackerPersistenceService,
	row: Pick<ChiefReviewRow, 'id' | 'chief_review'>
) {
	store.commitLocal(() => {
		const current = store.database
			.prepare('SELECT chief_review FROM items WHERE id = ? AND deleted = 0')
			.get(row.id) as { chief_review: string | null } | undefined;
		const review = readChiefReview(current?.chief_review);
		if (!review || current?.chief_review !== row.chief_review) return { result: false };
		const fields = { ...review.fields, chief_review: null, chief_answer: null };
		return { result: true, operation: { itemId: row.id, actor: review.actor, fields } };
	});
}
