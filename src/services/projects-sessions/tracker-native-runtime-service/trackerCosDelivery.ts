// @harness-uid u_bl6xl2h4a3
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { cosSendWindowStart } from './trackerCosWindow';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';
import type { TrackerCosSafetyNotice } from './trackerCosDelivery.types';

const minute = 60_000;
const noticeId = 'chief-review-safety';
const episodeKey = 'chief_review_safety_episode';
const reviewKinds = new Set(['chief-review', 'alert', 'flag-refused', 'cos-message']);

export function chiefReviewEmergency(kind: string, reason: string): boolean {
	return (
		kind === 'chief-review-emergency' ||
		kind.startsWith('credential exposure') ||
		/\b(?:prod(?:uction)? (?:is )?down|security incident|credential exposure|active compromise)\b/i.test(
			reason
		)
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
