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
	if (
		!store.chiefReview ||
		!['release', 'answer', 'resolve', 'unflag', 'unblock'].includes(verb ?? '')
	)
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
		const plan =
			verb === 'release'
				? releaseChiefReview(current, { ...body, by: actor }, context)
				: planTrackerItemMutation(
						{
							action: verb as 'answer' | 'resolve' | 'unflag' | 'unblock',
							item: reviewedAnswerItem(current, review.fields),
							body: { ...body, by: actor }
						},
						context
					);
		const fields = { ...plan.fields };
		const answer = verb === 'answer' || verb === 'resolve';
		if (answer) delete fields['note+'];
		return {
			result: undefined,
			operation: {
				...plan,
				actor,
				fields: {
					...fields,
					...(answer && { chief_answer: review.actor ?? 'Chief of Staff' }),
					...(verb !== 'release' && { chief_review: null })
				}
			}
		};
	});
	const committed = items.resolve(item.id);
	const result = items.getStored(item.id);
	return trackerResponse(
		200,
		committed.chief_answer
			? {
					...result,
					answer: committed.answer,
					answered_by: committed.answered_by,
					answered_at: committed.answered_at,
					resolved: Boolean(committed.resolved)
				}
			: result
	);
}

function reviewedAnswerItem(
	item: ReturnType<TrackerLocalApiDependencies['items']['resolve']>,
	fields: Record<string, unknown>
) {
	return {
		...item,
		options: typeof fields.options === 'string' ? fields.options : null,
		confirm: typeof fields.confirm === 'string' ? fields.confirm : null
	};
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
	if (
		typeof body.question !== 'string' ||
		!body.question.trim() ||
		options.length < 2 ||
		options.length > 4 ||
		options.filter(({ recommended }) => recommended).length !== 1
	)
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
	const chief = trackerReviewer(actor) === 'chief';
	const item = id ? items.resolve(id) : undefined;
	if (store.chiefReview && item && (chief || (actor && item.chief_answer === actor))) {
		return trackerResponse(200, {
			item_id: item.id,
			review: chief ? readChiefReview(item.chief_review) : null,
			...(item.chief_answer && { answer: item.answer, answered_at: item.answered_at })
		});
	}
	if (!store.chiefReview || !chief)
		throw trackerItemError('only Chief of Staff can read this queue', 403);
	const rows = store.database
		.prepare(
			'SELECT id, title, chief_review FROM items WHERE deleted = 0 AND chief_review IS NOT NULL ORDER BY updated_at'
		)
		.all() as { id: string; title: string; chief_review: string }[];
	return trackerResponse(
		200,
		rows.map(({ id, title, chief_review }) => ({
			id,
			title,
			review: readChiefReview(chief_review)
		}))
	);
}
