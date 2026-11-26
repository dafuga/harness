import { trackerPersonalAgent } from '../../../../../../src/utils/projects-sessions/trackerUnattendedHold';
import { trackerRepeatLabel } from '../../../../../../src/utils/projects-sessions/trackerRepeatLabel';
import type { TrackerItemRecord } from '../project-overview/projectOverviewTracker.types';
import { homeText } from './homeTrackerText';
import type { HomeReminder } from './hubHome.types';

const listed = 100;

function reminder(item: TrackerItemRecord): HomeReminder[] {
	if (!item.remindAt || item.status === 'done' || !trackerPersonalAgent(item.agent)) return [];
	return [
		{
			itemId: item.id,
			title: reminderTitle(homeText(item.title, 500) ?? 'Untitled reminder'),
			at: new Date(item.remindAt).toISOString(),
			repeats: trackerRepeatLabel(item.every),
			updatedAt: new Date(item.updated_at).toISOString()
		}
	];
}

/** Drops a leading "Reminder Sat 10:00:" label: the list already shows what and when. */
function reminderTitle(title: string): string {
	const label =
		/^\s*(?:(?:daily|weekly|monthly)\s+)?(?:personal\s+)?remind(?:er)?\b(?:[^:]|:(?=\d))*:\s+/i;
	const text = title.replace(label, '').trim() || title;
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * @pure The personal reminders, soonest first. The caller passes only items that may be
 * displayed; sensitive, deleted and ignored items are never passed.
 */
export function listHomeReminders(items: TrackerItemRecord[]): HomeReminder[] {
	return items
		.flatMap(reminder)
		.sort((a, b) => a.at.localeCompare(b.at) || a.itemId.localeCompare(b.itemId))
		.slice(0, listed);
}
