// @harness-uid u_xba7ieg4je
import { readChiefReview } from '../tracker-operation-repository/chiefReviewFields';
import type { TrackerItemRow } from '../TrackerItemReadRepository.types';

/**
 * The public side of an ask under review: that it is waiting, or that Chief of Staff answered.
 * Neither the draft question nor that answer is part of an item read; `tracker review` has them.
 */
export function trackerAnswerFields(row: TrackerItemRow) {
	const hidden = Boolean(row.chief_answer);
	const review = readChiefReview(row.chief_review);
	return {
		answer: hidden ? null : row.answer,
		answered_at: hidden ? null : row.answered_at,
		answered_by: hidden ? null : row.answered_by,
		resolved: !hidden && Boolean(row.resolved),
		...(hidden && { chief_answered: true }),
		...(review && { review_status: trackerReviewStatus(review.mode) })
	};
}

export function trackerReviewStatus(mode: string): string {
	return mode === 'approved' ? 'held until 08:00 Lisbon' : 'awaiting Chief of Staff review';
}
