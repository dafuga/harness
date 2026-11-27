// @harness-uid u_erx7kzqfu4
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { trackerStructuredAsk } from '../../../utils/projects-sessions/trackerStructuredAsk';
import { trackerPersonalAgent } from '../../../utils/projects-sessions/trackerUnattendedHold';
import type { PushAsk } from './webPush.types';

const askedAt = (item: TrackerItem) => Date.parse(item.asked_at ?? item.updated_at ?? '') || 0;

function projectOf({ agent }: TrackerItem) {
	const name = agent?.trim() ?? '';
	return name === '' ? 'Tracker' : name;
}

/**
 * What Home's "Blocked - needs you" would list, oldest first: the same structured-ask rule, and
 * like Home it never names a sensitive or personal item. The caller passes the flagged list, which
 * already leaves parked and snoozed items out.
 */
export function openPushAsks(flagged: TrackerItem[]): PushAsk[] {
	return flagged
		.filter(
			(item) =>
				!item.deleted &&
				!item.sensitive &&
				!trackerPersonalAgent(item.agent) &&
				trackerStructuredAsk(item)
		)
		.sort((a, b) => askedAt(a) - askedAt(b) || a.id.localeCompare(b.id))
		.map((item) => ({
			itemId: item.id,
			project: projectOf(item),
			question: item.question!.trim()
		}));
}
