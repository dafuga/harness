// @harness-uid u_g7kdpz7bel
import type { ChiefReview } from '../../../repositories/projects-sessions/tracker-operation-repository/chiefReviewFields.types';
import { hasPublishedAsk } from '../../../repositories/projects-sessions/tracker-operation-repository/hasPublishedAsk';
import type { TrackerItemFields } from '../../../utils/projects-sessions/normalizeTrackerItemFields.types';
import { planTrackerItemMutation } from '../../../utils/projects-sessions/planTrackerItemMutation';
import type {
	TrackerItemMutationContext,
	TrackerItemSnapshot
} from '../../../utils/projects-sessions/planTrackerItemMutation.types';
import { trackerAskOptions } from '../../../utils/projects-sessions/trackerAskOptions';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import type { ChiefReviewRequest } from './trackerChiefReview.types';

type ReviewStep = ChiefReviewRequest & { review: ChiefReview; reviewer: 'chief' | 'daniel' };

export function planChiefReviewStep(
	item: TrackerItemSnapshot,
	step: ReviewStep,
	context: TrackerItemMutationContext
) {
	return step.verb === 'release'
		? releasePlan(item, step, context)
		: answerPlan(item, step, context);
}

function answerPlan(
	item: TrackerItemSnapshot,
	{ verb, actor, body, review, reviewer }: ReviewStep,
	context: TrackerItemMutationContext
) {
	const { options, confirm } = review.fields;
	const plan = planTrackerItemMutation(
		{
			action: verb === 'resolve' ? 'resolve' : 'answer',
			item: {
				...item,
				options: typeof options === 'string' ? options : null,
				confirm: typeof confirm === 'string' ? confirm : null
			},
			body: { ...body, by: actor }
		},
		context
	);
	const fields: TrackerItemFields = { ...plan.fields, chief_review: null };
	if (reviewer !== 'chief') return { ...plan, fields };
	// A Chief of Staff answer goes to the session. It is not written into notes Daniel reads.
	delete fields['note+'];
	if (hasPublishedAsk(item)) return { ...plan, fields: besidePublishedAsk(verb, fields, review) };
	return { ...plan, fields: { ...fields, chief_answer: privateAnswerOwner(review) } };
}

function privateAnswerOwner(review: ChiefReview) {
	return review.actor ?? 'Chief of Staff';
}

/** Close only the held draft: the flag Daniel has stays open, with the answer kept private. */
function besidePublishedAsk(
	verb: ChiefReviewRequest['verb'],
	fields: TrackerItemFields,
	review: ChiefReview
): TrackerItemFields {
	if (verb === 'resolve') return { chief_review: null };
	const { answer, answered_at, answered_by, status } = fields;
	return {
		chief_review: null,
		chief_answer: privateAnswerOwner(review),
		answer,
		answered_at,
		answered_by,
		...(status !== undefined && { status })
	};
}

function releasePlan(
	item: TrackerItemSnapshot,
	{ actor, body, review }: ReviewStep,
	context: TrackerItemMutationContext
) {
	if (review.mode !== 'review') throw trackerItemError('this review cannot be released', 409);
	const plan = planTrackerItemMutation(
		{ action: 'flag', item, body: { ...body, by: actor } },
		context
	);
	assertReleasable(body.question, plan.fields);
	const next = review.fields.next_step ? { next_step: String(body.question) } : {};
	return { ...plan, fields: { ...plan.fields, ...keptFromDraft(review, body), ...next } };
}

/** Rewording an ask never drops its confirm step or the documents Daniel needs to read. */
function keptFromDraft({ fields }: ChiefReview, body: ChiefReviewRequest['body']) {
	const { confirm, attachments, attachment_docs } = fields;
	return {
		...(body.confirm === undefined && typeof confirm === 'string' && { confirm }),
		...(body.attachments === undefined &&
			typeof attachments === 'string' && {
				attachments,
				attachment_docs: String(attachment_docs ?? '') || null
			})
	};
}

function assertReleasable(question: unknown, fields: Record<string, unknown>) {
	if (!fields.needs_daniel)
		throw trackerItemError('a message for Chief of Staff cannot be released to Daniel', 409);
	const options = trackerAskOptions(fields.options as string | null);
	const complete = typeof question === 'string' && Boolean(question.trim());
	const choices = options.length >= 2 && options.length <= 4;
	if (!complete || !choices || options.filter(({ recommended }) => recommended).length !== 1)
		throw trackerItemError('release needs a question, 2 to 4 options and one recommendation');
}
