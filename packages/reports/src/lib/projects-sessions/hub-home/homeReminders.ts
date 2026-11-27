// @harness-uid u_qb53xa7234
import {
	trackerPersonalReminder,
	trackerReminderName
} from '../../../../../../src/utils/projects-sessions/trackerPersonalReminder';
import type { TrackerItemRecord } from '../project-overview/projectOverviewTracker.types';
import { homeText } from './homeTrackerText';
import type { HomeReminder } from './hubHome.types';

const listed = 100;

function reminder(item: TrackerItemRecord): HomeReminder[] {
	const armed = trackerPersonalReminder(item);
	if (!armed) return [];
	return [
		{
			itemId: item.id,
			title: trackerReminderName(homeText(item.title, 500) ?? 'Untitled reminder'),
			...armed,
			updatedAt: new Date(item.updated_at).toISOString()
		}
	];
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
