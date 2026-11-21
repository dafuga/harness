// @harness-uid u_4u4zilrc3c
import type { WallTime } from './attentionTiming.types';
import { zonedWallClock } from './zonedWallClock';

/** @pure Convert a wall-clock time in a time zone to epoch milliseconds, accounting for its UTC offset (days may overflow). */
export function wallClockToEpochMs(wall: WallTime, tz: string): number {
	const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
	const first = guess - offsetMs(guess, tz);
	const second = offsetMs(first, tz);
	return guess - second === first ? first : guess - second;
}

/** @pure Offset of a zone from UTC at an instant, in milliseconds. */
function offsetMs(atMs: number, tz: string): number {
	const z = zonedWallClock(atMs, tz);
	return (
		Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second) -
		Math.floor(atMs / 1000) * 1000
	);
}
