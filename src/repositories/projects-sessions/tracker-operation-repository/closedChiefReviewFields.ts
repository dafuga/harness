// @harness-uid u_c5mwmd6z6z
import type { TrackerOperation } from '../TrackerOperationRepository.types';
import type { ChiefReview, CurrentChiefReview } from './chiefReviewFields.types';

/** A change that ends the wait also drops the held ask; a newer answer is no longer private. */
export function closedReviewFields(
	fields: TrackerOperation['fields'],
	current: CurrentChiefReview | undefined
): TrackerOperation['fields'] {
	const review = current?.chief_review ? (JSON.parse(current.chief_review) as ChiefReview) : null;
	const newerAnswer =
		current?.chief_answer && 'answered_at' in fields && !('chief_answer' in fields);
	return {
		...fields,
		...(review && endsWait(fields, review) && { chief_review: null }),
		...(newerAnswer && { chief_answer: null })
	};
}

function endsWait(fields: TrackerOperation['fields'], review: ChiefReview) {
	if (fields.needs_daniel === 0 || fields.resolved === 1 || fields.deleted === 1) return true;
	const blockerOnly = !review.fields.needs_daniel;
	return blockerOnly && typeof fields.status === 'string' && fields.status !== 'blocked';
}
