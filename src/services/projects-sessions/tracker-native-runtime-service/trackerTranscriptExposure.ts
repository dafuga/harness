// @harness-uid u_bl6xl2h4a3
import { isTrackerAwaitingAnswer } from '../../../utils/projects-sessions/isTrackerAwaitingAnswer';
import { createHash } from 'node:crypto';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { planTrackerItemMutation } from '../../../utils/projects-sessions/planTrackerItemMutation';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerTranscriptExposure } from './trackerTranscriptExposure.types';
import { recordWatchdogAlert } from './trackerHostWatchdogAlerts';

export function recordTrackerTranscriptExposure(
	store: TrackerPersistenceService,
	exposure: TrackerTranscriptExposure,
	now: number
): void {
	const { type, byte, session, identity, itemId } = exposure;
	const event = createHash('sha256')
		.update(identity + ':' + type)
		.digest('hex');
	const marker = 'tracker_secret_report:' + event;
	if (Number(store.getMeta(marker) ?? -1) >= byte) return;
	const items = new TrackerItemReadRepository(store.database);
	const source = storedItem(items, itemId);
	const rotationId = event.slice(0, 10);
	const previousRotation = storedItem(items, rotationId);
	const persist = () => store.writeMeta({ [marker]: String(byte) });
	if (previousRotation && previousRotation.status !== 'done') {
		persist();
		return;
	}
	const question = `${type} detected in session ${session}, byte ${byte}. Rotate affected credentials through the secret-safe path.`;
	const note = source ? `Tracker item ${source.id}. ${question}` : question;
	const fields = previousRotation
		? { status: 'open', resolved: 0, 'note+': note }
		: planTrackerItemMutation(
				{
					action: 'add',
					itemId: rotationId,
					body: {
						title: `Rotate exposed ${type} (${session.slice(0, 8)})`,
						agent: 'tracker',
						sensitive: true,
						notes: note
					}
				},
				{ now, node: store.node, candidates: [] }
			).fields;
	if (source)
		recordWatchdogAlert(
			store,
			{
				itemId: source.id,
				kind: 'credential exposure: ' + type,
				reason: question,
				identity: event + ':' + byte
			},
			now
		);
	flagExposedSource(store, source, question);
	store.appendLocal(
		{ itemId: rotationId, fields: { ...fields, needs_daniel: 1, question } },
		persist
	);
}

/** A leaked credential is a security alert, not a session ping, so the source stays flagged. */
function flagExposedSource(
	store: TrackerPersistenceService,
	source: ReturnType<typeof storedItem>,
	question: string
) {
	if (source && !isTrackerAwaitingAnswer(source))
		store.appendLocal({ itemId: source.id, fields: { needs_daniel: 1, resolved: 0, question } });
}

function storedItem(items: TrackerItemReadRepository, id?: string) {
	if (!id) return undefined;
	try {
		return items.getStored(id);
	} catch {
		return undefined;
	}
}
