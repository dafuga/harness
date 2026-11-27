// @harness-uid u_gvqtr5mdwv
import { z } from 'zod';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { recordWatchdogAlert } from '../tracker-native-runtime-service/trackerHostWatchdogAlerts';

const refusal = z.object({
	code: z.literal('open_duplicate'),
	matches: z.array(z.object({ id: z.string(), same_agent: z.boolean(), score: z.number() })).min(1)
});

/** Preserve the CLI's duplicate exit and the identity of the original goal in the CoS inbox. */
export async function reportDuplicateAdd(
	response: Promise<Response>,
	store: TrackerPersistenceService,
	now: () => number
) {
	const result = await response;
	if (result.status !== 409) return result;
	const match = refusal.safeParse(await result.clone().json());
	if (!match.success) return result;
	const ids = match.data.matches.map(({ id }) => id);
	const reason =
		ids.length === 1 && match.data.matches[0].score === 1
			? `Duplicate add linked to open Tracker item ${ids[0]}. Continue the goal on that item.`
			: 'Possible duplicate add. Review open Tracker items ' + ids.join(', ');
	recordWatchdogAlert(
		store,
		{
			itemId: ids[0],
			key: 'duplicate-add:' + ids[0],
			kind: 'cos-message',
			reason,
			identity: ids.join(',')
		},
		now()
	);
	return result;
}

/** Two disconnected computers can both accept the same goal. Link their already-created items
 * after the journals meet, without deleting either computer's work or moving its ownership. */
export function reviewIncomingAdds(
	store: TrackerPersistenceService,
	ids: string[],
	now: () => number
) {
	if (!ids.length) return;
	const active = store.database.prepare(`SELECT other.id FROM items incoming JOIN items other
		ON lower(trim(other.title))=lower(trim(incoming.title))
		WHERE coalesce(lower(other.project),lower(other.agent),'')=coalesce(lower(incoming.project),lower(incoming.agent),'')
		AND incoming.id=? AND incoming.deleted=0 AND incoming.status IN ('open','in_progress','blocked')
		AND other.deleted=0 AND other.status IN ('open','in_progress','blocked')
		ORDER BY coalesce(other.created_at,''),other.id`);
	for (const id of ids) {
		const matches = active.all(id) as { id: string }[];
		if (matches.length < 2) continue;
		const original = matches[0].id;
		for (const duplicate of matches.slice(1)) {
			const reason = `Duplicate goal from concurrent intake. Continue on ${original}. Review linked item ${duplicate.id} before closing it.`;
			recordWatchdogAlert(
				store,
				{
					itemId: duplicate.id,
					key: 'duplicate-fleet:' + duplicate.id,
					kind: 'cos-message',
					reason,
					identity: original
				},
				now()
			);
		}
	}
}
