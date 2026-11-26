// @harness-uid u_yvymmfkndf
import { nextReminderSlotAt } from '../../../helpers/attention-timing/nextReminderSlotAt';
import { danielQuietHours } from '../tracker-notification-service/notificationRules';
import { trackerHealthTimes } from './trackerHealthTimes';

const startupDelay = 5 * 60_000;

export function nextTrackerHealthAt(now: number, first: boolean): number {
	return first
		? now + startupDelay
		: nextReminderSlotAt(now, trackerHealthTimes, danielQuietHours.tz);
}
