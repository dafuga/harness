// @harness-uid u_g7kdpz7bel
import {
	readChiefReview,
	trackerReviewer
} from '../../../repositories/projects-sessions/tracker-operation-repository/chiefReviewFields';
import { trackerAskOptions } from '../../../utils/projects-sessions/trackerAskOptions';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import { planTrackerItemMutation } from '../../../utils/projects-sessions/planTrackerItemMutation';
import type { TrackerItemInput } from '../../../utils/projects-sessions/normalizeTrackerItemFields.types';
import type { TrackerLocalApiDependencies } from '../TrackerLocalApiService.types';
import { itemMutationContext } from './trackerLocalItemMutation';
import { trackerResponse } from './trackerLocalResponse';

/** Deal with private review actions while the item and its journal are locked. */
export function writeChiefReview(
	ports: TrackerLocalApiDependencies,
	id: string,
	input: { verb: string | undefined; actor: string | null; body: TrackerItemInput }
): Response | undefined {
	const { store, items, options } = ports;
	const { verb, actor, body } = input;
	if (!store.chiefReview || !['release', 'answer', 'resolve', 'unflag', 'unblock'].includes(verb ?? ''))
		return undefined;
	const item = items.resolve(id);
	const review = readChiefReview(item.chief_review);
	if (!review) {
		if (verb === 'release') throw trackerItemError('no ask awaiting Chief of Staff review', 409);
		return undefined;
	}
	const withdraw = (verb === 'unflag' || verb === 'unblock') && review.actor === actor;
	if (!withdraw && trackerReviewer(actor) !== 'chief')
		throw trackerItemError('this ask is awaiting Chief of Staff review', 403);
	const context = itemMutationContext(store, items, options);
	store.commitLocal(() => {
		const current = items.resolve(item.id);
		if (current.chief_review !== item.chief_review)
			throw trackerItemError('the ask changed during review', 409);
		const plan = verb === 'release'
			? releaseChiefReview(current, { ...body, by: actor }, context)
			: planTrackerItemMutation(
				{ action: verb as 'answer' | 'resolve' | 'unflag' | 'unblock', item: current, body: { ...body, by: actor } },
				context
			);
		return {
			result: undefined,
			operation: { ...plan, actor, fields: {
				...plan.fields,
				...((verb === 'answer' || verb === 'resolve') && { chief_answer: 1 }),
				...(verb !== 'release' && { chief_review: null })
			} }
		};
	});
	return trackerResponse(200, items.getStored(item.id));
}

function releaseChiefReview(
	item: ReturnType<TrackerLocalApiDependencies['items']['resolve']>,
	body: TrackerItemInput,
	context: ReturnType<typeof itemMutationContext>
) {
	const review = readChiefReview(item.chief_review);
	if (review?.mode !== 'review') throw trackerItemError('this review cannot be released', 409);
	const next = typeof review.fields.next_step === 'string' ? review.fields.next_step : undefined;
	const plan = planTrackerItemMutation({ action: 'flag', item, body }, context);
	const options = trackerAskOptions(plan.fields.options);
	if (typeof body.question !== 'string' || !body.question.trim() ||
		options.length < 2 || options.length > 4 || options.filter(({ recommended }) => recommended).length !== 1)
		throw trackerItemError('release needs a question, 2 to 4 options and one recommendation');
	if (!plan.fields.needs_daniel)
		throw trackerItemError('a message for Chief of Staff cannot be released to Daniel', 409);
	return { ...plan, fields: { ...plan.fields, ...(next && { next_step: body.question }) } };
}

export function readChiefReviews(
	{ store, items }: TrackerLocalApiDependencies,
	id: string | undefined,
	actor: string | null
): Response {
	if (!store.chiefReview || trackerReviewer(actor) !== 'chief')
		throw trackerItemError('only Chief of Staff can read this queue', 403);
	const item = id ? items.resolve(id) : undefined;
	if (item) return trackerResponse(200, { item_id: item.id, review: readChiefReview(item.chief_review) });
	const rows = store.database.prepare(
		'SELECT id, title, chief_review FROM items WHERE deleted = 0 AND chief_review IS NOT NULL ORDER BY updated_at'
	).all() as { id: string; title: string; chief_review: string }[];
	return trackerResponse(200, rows.map(({ id, title, chief_review }) => ({
		id, title, review: readChiefReview(chief_review)
	})));
}
