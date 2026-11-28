// @harness-uid u_c5mwmd6z6z
import { isDeepStrictEqual } from 'node:util';
import { trackerClockMilliseconds } from '../../../utils/projects-sessions/nextTrackerClock';
import type { TrackerOperation } from '../TrackerOperationRepository.types';
import type { ChiefReview, ChiefReviewHold, ChiefReviewAsk } from './chiefReviewFields.types';

export const privateAskFields = [
	'question',
	'options',
	'confirm',
	'attachments',
	'attachment_docs',
	'next_step'
];

/** Move an ask's contents into the private review record. */
export function heldReviewFields(
	operation: TrackerOperation,
	ask: ChiefReviewAsk,
	{ current, mode }: ChiefReviewHold
): TrackerOperation['fields'] {
	const { visible, details } = splitAsk(operation.fields, ask);
	const previous = current?.chief_review ? (JSON.parse(current.chief_review) as ChiefReview) : null;
	const review = mergeReview(previous, {
		at: trackerClockMilliseconds(operation.hlc),
		generation: operation.hlc,
		actor: operation.actor ?? null,
		mode,
		fields: details
	});
	// A blocker alone leaves any flag Daniel already has exactly where it is.
	const hidden = ask.flag && { needs_daniel: 0 };
	return { ...visible, ...hidden, chief_review: JSON.stringify(review) };
}

function splitAsk(fields: TrackerOperation['fields'], ask: ChiefReviewAsk) {
	const visible = { ...fields };
	const details: Record<string, unknown> = ask.flag ? { needs_daniel: 1, resolved: 0 } : {};
	for (const key of privateAskFields) {
		if (!ask.flag && (visible[key] ?? null) === null) continue;
		if (key in visible) details[key] = visible[key];
		visible[key] = null;
	}
	if (ask.blocker) {
		details.blocked_reason = visible.blocked_reason;
		visible.blocked_reason = null;
		delete visible['note+'];
	}
	return { visible, details };
}

/**
 * One review per item. A later block or flag adds to the held ask, a Tracker message never
 * replaces a session's question, an identical repeat is not raised again, and the 30-minute
 * clock keeps running from the first unanswered version.
 */
function mergeReview(previous: ChiefReview | null, next: ChiefReview): ChiefReview {
	if (!previous || next.mode === 'approved' || previous.mode === 'approved') return next;
	const keepQuestion = previous.mode === 'review' && next.mode === 'chief-only';
	const fields = keepQuestion
		? { ...next.fields, ...present(previous.fields) }
		: { ...previous.fields, ...next.fields };
	const mode = keepQuestion ? 'review' : next.mode;
	if (mode === previous.mode && isDeepStrictEqual(fields, previous.fields)) return previous;
	return { ...next, at: previous.at, mode, fields };
}

function present(fields: Record<string, unknown>) {
	return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null));
}
