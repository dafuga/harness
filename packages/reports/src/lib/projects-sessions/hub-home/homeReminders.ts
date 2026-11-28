// @harness-uid u_qb53xa7234
import {
	trackerPersonalName,
	trackerReminderName
} from '../../../../../../src/utils/projects-sessions/trackerReminderName';
import { trackerUpcomingReminder } from '../../../../../../src/utils/projects-sessions/trackerUpcomingReminder';
import type { TrackerItemRecord } from '../project-overview/projectOverviewTracker.types';
import { homeText } from './homeTrackerText';
import type { HomeReminder } from './hubHome.types';

const listed = 100;

function reminder(item: TrackerItemRecord, now: number): HomeReminder[] {
	const upcoming = trackerUpcomingReminder({ ...item, autoLaunch: item.launchRequested }, now);
	if (!upcoming) return [];
	const title = homeText(item.title, 500) ?? 'Untitled reminder';
	const work = upcoming.group === 'work';
	return [
		{
			itemId: item.id,
			title: work ? trackerReminderName(title) : trackerPersonalName(title),
			...upcoming,
			project: work ? homeText(item.project || item.agent, 200) : null,
			updatedAt: new Date(item.updated_at).toISOString()
		}
	];
}

/**
 * @pure The upcoming and overdue reminders, soonest first. The caller passes only items that may
 * be displayed; sensitive, deleted and ignored items are never passed.
 */
export function listHomeReminders(items: TrackerItemRecord[], now: number): HomeReminder[] {
	return items
		.flatMap((item) => reminder(item, now))
		.sort((a, b) => a.at.localeCompare(b.at) || a.itemId.localeCompare(b.itemId))
		.slice(0, listed);
}
