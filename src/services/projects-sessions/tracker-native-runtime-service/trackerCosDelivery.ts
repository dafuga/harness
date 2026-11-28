// @harness-uid u_bl6xl2h4a3
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { cosSendWindowStart } from '../../../utils/projects-sessions/trackerCosSendWindow';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';
import type { TrackerCosSafetyNotice } from './trackerCosDelivery.types';

const minute = 60_000;
const noticeId = 'chief-review-safety';
const episodeKey = 'chief_review_safety_episode';
const reviewKinds = new Set(['chief-review', 'alert', 'flag-refused', 'cos-message']);

const emergencies = [
	/\bprod(?:uction)?\b[^.;]{0,40}\b(?:is |went )?(?:down|outage)\b|\boutage in prod(?:uction)?\b/i,
	/\bsecurity (?:incident|breach|hole|vulnerability|compromise)\b|\bactive compromise\b/i,
	/\bcredential exposure\b|\b(?:secret|credential|token|api key|private key|password)s?\b[^.;]{0,60}\b(?:detected in session|exposed|leaked|compromised)\b/i,
	/\b(?:exposed|leaked|compromised)\b[^.;]{0,40}\b(?:secret|credential|token|api key|private key|password)s?\b/i
];

/** @pure Prod-down and security asks wait 10 minutes for Chief of Staff instead of 30. */
export function chiefReviewEmergency(kind: string, reason: string): boolean {
	return (
		kind === 'chief-review-emergency' ||
		kind.startsWith('credential exposure') ||
		emergencies.some((pattern) => pattern.test(reason))
	);
}

/** A receipt ends waiting. Emit at most one content-free notice per uninterrupted backlog. */
export function watchCosDelivery(
	store: TrackerPersistenceService,
	pending: readonly TrackerWatchdogAlert[],
	now: number
): void {
	const waiting = pending.filter(
		({ kind, reason }) => reviewKinds.has(kind) || chiefReviewEmergency(kind, reason)
	);
	const open = store.getMeta(episodeKey) === '1';
	if (!waiting.length) {
		if (open) store.writeMeta({ [episodeKey]: '0' });
		return;
	}
	if (open) return;
	const emergency = waiting.some(
		({ kind, reason, at }) => chiefReviewEmergency(kind, reason) && now - at >= 10 * minute
	);
	const routine =
		cosSendWindowStart(now) !== null && waiting.some(({ at }) => now - at >= 30 * minute);
	if (emergency || routine)
		writeNotice(store, { generation: String(now), count: waiting.length, emergency });
}

function writeNotice(store: TrackerPersistenceService, notice: TrackerCosSafetyNotice) {
	store.appendLocal(
		{ itemId: noticeId, fields: { chief_safety_notice: JSON.stringify(notice) } },
		() => store.writeMeta({ [episodeKey]: '1' })
	);
}

export function readCosSafetyNotice(
	store: TrackerPersistenceService
): TrackerCosSafetyNotice | undefined {
	const row = store.database
		.prepare('SELECT chief_safety_notice FROM items WHERE id = ?')
		.get(noticeId) as { chief_safety_notice: string | null } | undefined;
	return row?.chief_safety_notice
		? (JSON.parse(row.chief_safety_notice) as TrackerCosSafetyNotice)
		: undefined;
}

export function completeCosSafetyNotice(
	store: TrackerPersistenceService,
	generation: string
): void {
	store.commitLocal(() => ({
		result: undefined,
		...(readCosSafetyNotice(store)?.generation === generation && {
			operation: { itemId: noticeId, fields: { chief_safety_notice: null } }
		})
	}));
}
