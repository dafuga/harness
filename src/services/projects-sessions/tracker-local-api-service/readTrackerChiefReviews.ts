// @harness-uid u_g7kdpz7bel
import { readChiefReview } from '../../../repositories/projects-sessions/tracker-operation-repository/chiefReviewFields';
import { trackerReviewStatus } from '../../../repositories/projects-sessions/tracker-item-read-repository/trackerAnswerFields';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import { trackerReviewer } from '../../../utils/projects-sessions/trackerReviewer';
import type { TrackerLocalApiDependencies } from '../TrackerLocalApiService.types';
import { trackerResponse } from './trackerLocalResponse';

/**
 * `tracker review <id>` is how a session reads its answer; only Chief of Staff reads drafts and
 * the queue. No Daniel-facing app calls this route.
 */
export function readChiefReviews(
	ports: TrackerLocalApiDependencies,
	id: string | undefined,
	actor: string | null
): Response {
	if (!ports.store.chiefReview) throw trackerItemError('ask review is not enabled', 404);
	const chief = trackerReviewer(actor) === 'chief';
	if (id) return trackerResponse(200, itemReview(ports, id, chief));
	if (!chief) throw trackerItemError('only Chief of Staff can read this queue', 403);
	return trackerResponse(200, reviewQueue(ports));
}

function itemReview({ items }: TrackerLocalApiDependencies, id: string, chief: boolean) {
	const item = items.resolve(id);
	const review = readChiefReview(item.chief_review);
	return {
		item_id: item.id,
		review: chief ? review : null,
		...(review && { status: trackerReviewStatus(review.mode) }),
		...(item.chief_answer && { answer: item.answer, answered_at: item.answered_at })
	};
}

function reviewQueue({ store }: TrackerLocalApiDependencies) {
	const rows = store.database
		.prepare(
			`SELECT id, title, chief_review FROM items WHERE deleted = 0 AND status <> 'ignored'
			AND chief_review IS NOT NULL ORDER BY updated_at`
		)
		.all() as { id: string; title: string; chief_review: string }[];
	return rows.map(({ id, title, chief_review }) => ({
		id,
		title,
		review: readChiefReview(chief_review)
	}));
}
