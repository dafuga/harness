// @harness-uid u_c5mwmd6z6z
import { isTrackerBlockedOnDaniel } from '../../../utils/projects-sessions/isTrackerBlockedOnDaniel';
import { isTrackerCosMessage } from '../../../utils/projects-sessions/isTrackerPing';
import { trackerClockMilliseconds } from '../../../utils/projects-sessions/nextTrackerClock';
import { cosSendWindowStart } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerCosWindow';
import type { TrackerOperation } from '../TrackerOperationRepository.types';
import type { ChiefReview } from './chiefReviewFields.types';

const privateFields = [
	'question', 'options', 'confirm', 'attachments', 'attachment_docs', 'next_step'
];

export function trackerReviewer(actor: string | null | undefined): 'chief' | 'daniel' | null {
	const name = actor?.split('@')[0]?.trim();
	if (/^(?:cos|chief[-_ ]of[-_ ]staff)$/i.test(name ?? '')) return 'chief';
	if (/^(?:daniel(?: fugere)?|danielfugere)$/i.test(name ?? '')) return 'daniel';
	return null;
}

/** Keep an ask's contents out of every public item field until the reviewer releases it. */
export function chiefReviewFields(operation: TrackerOperation, migrate = false) {
	const { fields, actor, hlc } = operation;
	if (Object.hasOwn(fields, 'chief_review')) return fields;
	const blocker = typeof fields.blocked_reason === 'string' && isTrackerBlockedOnDaniel(fields.blocked_reason);
	const question = typeof fields.question === 'string' ? fields.question : null;
	const asks = Number(fields.needs_daniel) === 1 && Number(fields.resolved) !== 1;
	if (!asks && !blocker) return fields;

	const chiefOnly = isTrackerCosMessage(question) ||
		/^\d+ Tracker alerts? (?:has|have) not reached your Chief of Staff session\b/i.test(question ?? '') ||
		fields.title === 'Tracker alerts are not reaching Chief of Staff';
	const approved = !migrate && trackerReviewer(actor) !== null && !chiefOnly;
	const at = trackerClockMilliseconds(hlc);
	if (approved && cosSendWindowStart(at) !== null)
		return { ...fields, chief_review: null };

	const pending = { ...fields };
	const details: Record<string, unknown> = {};
	for (const key of privateFields) {
		if (key in pending) details[key] = pending[key];
		pending[key] = null;
	}
	if (blocker) {
		details.blocked_reason = pending.blocked_reason;
		pending.blocked_reason = null;
		delete pending['note+'];
	}
	const review: ChiefReview = {
		at,
		generation: hlc,
		actor: actor ?? null,
		mode: chiefOnly ? 'chief-only' : approved && asks ? 'approved' : 'review',
		fields: details
	};
	return { ...pending, needs_daniel: 0, chief_review: JSON.stringify(review) };
}

export function readChiefReview(value: string | null | undefined): ChiefReview | null {
	return value ? (JSON.parse(value) as ChiefReview) : null;
}
