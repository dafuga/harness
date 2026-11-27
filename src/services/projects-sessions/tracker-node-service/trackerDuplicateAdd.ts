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
