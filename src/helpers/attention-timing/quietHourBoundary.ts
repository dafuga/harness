// @harness-uid u_dhzfrqpvy4
import type { QuietHours } from './attentionTiming.types';
import { clockMinutes } from './clockMinutes';
import { isQuietHour } from './isQuietHour';
import { wallClockToEpochMs } from './wallClockToEpochMs';
import { zonedWallClock } from './zonedWallClock';

/** @pure Earliest instant at or after atMs outside quiet hours: the end of the current quiet window, or atMs when not quiet. */
export function quietHourBoundary(atMs: number, quiet: QuietHours | null | undefined): number {
	if (!quiet || !isQuietHour(atMs, quiet)) return atMs;
	const end = clockMinutes(quiet.end);
	const now = zonedWallClock(atMs, quiet.tz);
	const current = now.hour * 60 + now.minute;
	const dayOffset = current >= end ? 1 : 0;
	return wallClockToEpochMs(
		{
			year: now.year,
			month: now.month,
			day: now.day + dayOffset,
			hour: Math.floor(end / 60),
			minute: end % 60
		},
		quiet.tz
	);
}
