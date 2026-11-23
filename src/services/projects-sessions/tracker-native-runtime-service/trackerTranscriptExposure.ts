// @harness-uid u_bl6xl2h4a3
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
		.update(JSON.stringify([identity, type]))
		.digest('hex');
	const marker = 'tracker_secret_report:' + event;
	if (store.getMeta(marker)) return;
	const items = new TrackerItemReadRepository(store.database);
	const source = sourceItem(items, itemId);
	const location = `session ${session}, byte ${byte}`;
	const question = `${type} detected in ${location}. Rotate all affected credentials via the secret-safe path.`;
	const rotation = planTrackerItemMutation(
		{
			action: 'add',
			itemId: event.slice(0, 10),
			body: {
				title: `Rotate exposed ${type} (${session.slice(0, 8)})`,
				agent: 'tracker',
				sensitive: true,
				notes: source ? `Tracker item ${source.id}. ${question}` : question
			}
		},
		{ now, node: store.node, candidates: [] }
	);
	if (source)
		recordWatchdogAlert(
			store,
			{
				itemId: source.id,
				kind: 'credential exposure: ' + type,
				reason: question,
				identity: event
			},
			now,
			question
		);
	store.appendLocal(
		{ itemId: rotation.itemId, fields: { ...rotation.fields, needs_daniel: 1, question } },
		() => store.writeMeta({ [marker]: '1' })
	);
}

function sourceItem(items: TrackerItemReadRepository, id?: string) {
	if (!id) return undefined;
	try {
		return items.getStored(id);
	} catch {
		return undefined;
	}
}
