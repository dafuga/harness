// @harness-uid u_g7kdpz7bel
import { readChiefReview } from '../../../repositories/projects-sessions/tracker-operation-repository/chiefReviewFields';
import type { ChiefReview } from '../../../repositories/projects-sessions/tracker-operation-repository/chiefReviewFields.types';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import { trackerReviewer } from '../../../utils/projects-sessions/trackerReviewer';
import type { TrackerLocalApiDependencies } from '../TrackerLocalApiService.types';
import { itemMutationContext } from './trackerLocalItemMutation';
import { trackerResponse } from './trackerLocalResponse';
import { planChiefReviewStep } from './planChiefReviewStep';
import type { ChiefReviewRequest } from './trackerChiefReview.types';

const reviewVerbs = new Set(['release', 'answer', 'resolve']);

/** Release or answer a held ask while the item and its journal are locked. */
export function writeChiefReview(
	ports: TrackerLocalApiDependencies,
	id: string,
	request: ChiefReviewRequest
): Response | undefined {
	const { store, items } = ports;
	if (!store.chiefReview || !reviewVerbs.has(request.verb ?? '')) return undefined;
	const item = items.resolve(id);
	const review = readChiefReview(item.chief_review);
	if (!review) {
		if (request.verb === 'release')
			throw trackerItemError('no ask awaiting Chief of Staff review', 409);
		return undefined;
	}
	const reviewer = allowedReviewer(request);
	commitReviewStep(ports, item, { ...request, review, reviewer });
	const stored = items.getStored(item.id);
	return trackerResponse(200, reviewReply(ports, item.id, stored));
}

function allowedReviewer({ verb, actor }: ChiefReviewRequest) {
	const reviewer = trackerReviewer(actor);
	if (reviewer === 'chief' || (reviewer === 'daniel' && verb !== 'release')) return reviewer;
	throw trackerItemError('this ask is awaiting Chief of Staff review', 403);
}

function commitReviewStep(
	{ store, items, options }: TrackerLocalApiDependencies,
	item: ReturnType<TrackerLocalApiDependencies['items']['resolve']>,
	step: ChiefReviewRequest & { review: ChiefReview; reviewer: 'chief' | 'daniel' }
) {
	const context = itemMutationContext(store, items, options);
	store.commitLocal(() => {
		const current = items.resolve(item.id);
		if (current.chief_review !== item.chief_review)
			throw trackerItemError('the ask changed during review', 409);
		const plan = planChiefReviewStep(current, step, context);
		return { result: undefined, operation: { ...plan, actor: step.actor } };
	});
}

/** The reviewer sees the answer they just recorded, which item reads keep private. */
function reviewReply(
	{ items }: TrackerLocalApiDependencies,
	id: string,
	stored: ReturnType<TrackerLocalApiDependencies['items']['getStored']>
) {
	if (!stored.chief_answered) return stored;
	const { answer, answered_by, answered_at } = items.resolve(id);
	return { ...stored, answer, answered_by, answered_at, resolved: true };
}
