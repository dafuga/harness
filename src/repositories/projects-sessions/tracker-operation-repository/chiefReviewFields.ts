// @harness-uid u_c5mwmd6z6z
import { trackerClockMilliseconds } from '../../../utils/projects-sessions/nextTrackerClock';
import { isTrackerBlockedOnDaniel } from '../../../utils/projects-sessions/isTrackerBlockedOnDaniel';
import {
	isTrackerPlumbingAsk,
	trackerReviewer
} from '../../../utils/projects-sessions/trackerReviewer';
import { cosSendWindowStart } from '../../../utils/projects-sessions/trackerCosSendWindow';
import type { TrackerOperation } from '../TrackerOperationRepository.types';
import { closedReviewFields } from './closedChiefReviewFields';
import { heldReviewFields, privateAskFields } from './heldChiefReviewFields';
import type { ChiefReview, ChiefReviewAsk, ChiefReviewContext } from './chiefReviewFields.types';

/** Keep an ask's contents out of every public item field until the reviewer releases it. */
export function chiefReviewFields(
	operation: TrackerOperation,
	context: ChiefReviewContext = {}
): TrackerOperation['fields'] {
	const { fields } = operation;
	const { current } = context;
	if (Object.hasOwn(fields, 'chief_review')) return fields;
	const ask = readAsk(fields);
	if (!ask.flag && !ask.blocker) return closedReviewFields(fields, current);
	if (restatesReleasedAsk(fields, ask, current)) return fields;
	return reviewedAskFields(operation, ask, context);
}

/** Publish what a reviewer raised in the daytime; hold everything else. */
function reviewedAskFields(
	operation: TrackerOperation,
	ask: ChiefReviewAsk,
	{ current, migrate = false }: ChiefReviewContext
): TrackerOperation['fields'] {
	const { fields, actor, hlc } = operation;
	const chiefOnly = isTrackerPlumbingAsk(actor, ask.text, fields.title);
	const approved = !migrate && !chiefOnly && trackerReviewer(actor) !== null;
	if (approved && cosSendWindowStart(trackerClockMilliseconds(hlc)) !== null)
		return {
			...fields,
			chief_review: null,
			...(ask.flag && clearedPrivateAnswer(current?.chief_answer))
		};
	return heldReviewFields(operation, ask, { current, mode: reviewMode(chiefOnly, approved) });
}

/** Restoring a published flag, as unignore does, carries no wording that needs a new review. */
function restatesReleasedAsk(
	fields: TrackerOperation['fields'],
	ask: ChiefReviewAsk,
	current: ChiefReviewContext['current']
) {
	const published = current?.needs_daniel === 1 && current.resolved !== 1;
	return published && !ask.blocker && !privateAskFields.some((key) => key in fields);
}

/** A released ask must not show the private answer an earlier review left behind. */
function clearedPrivateAnswer(answeredBy: string | null | undefined) {
	return {
		chief_answer: null,
		...(answeredBy && { answer: null, answered_at: null, answered_by: null })
	};
}

function readAsk(fields: TrackerOperation['fields']) {
	const reason = typeof fields.blocked_reason === 'string' ? fields.blocked_reason : null;
	const question = typeof fields.question === 'string' ? fields.question : null;
	return {
		blocker: reason !== null && isTrackerBlockedOnDaniel(reason),
		flag: Number(fields.needs_daniel) === 1 && Number(fields.resolved) !== 1,
		text: question ?? reason ?? ''
	};
}

function reviewMode(chiefOnly: boolean, approved: boolean): ChiefReview['mode'] {
	if (chiefOnly) return 'chief-only';
	return approved ? 'approved' : 'review';
}

export function readChiefReview(value: string | null | undefined): ChiefReview | null {
	return value ? (JSON.parse(value) as ChiefReview) : null;
}
