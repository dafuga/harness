// @harness-uid u_ycrneh6g6i
import { clockMinutes } from './clockMinutes';
import { wallClockToEpochMs } from './wallClockToEpochMs';
import { zonedWallClock } from './zonedWallClock';

/** @pure The earliest fixed daily reminder slot ("09:00", "13:00", ...) strictly after atMs in a time zone. */
export function nextReminderSlotAt(atMs: number, times: readonly string[], tz: string): number {
	const minutes = [...new Set(times.map(clockMinutes))].sort((a, b) => a - b);
	if (!minutes.length) throw new RangeError('reminderTimes is empty');
	const today = zonedWallClock(atMs, tz);
	for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
		for (const slot of minutes) {
			const at = wallClockToEpochMs(
				{
					year: today.year,
					month: today.month,
					day: today.day + dayOffset,
					hour: Math.floor(slot / 60),
					minute: slot % 60
				},
				tz
			);
			if (at > atMs) return at;
		}
	}
	throw new RangeError('no reminder slot found');
}
