// @harness-uid u_ogfnbgfa7l
import type { QuietHours } from './attentionTiming.types';
import { clockMinutes } from './clockMinutes';
import { zonedWallClock } from './zonedWallClock';

/** @pure Whether an instant falls inside the quiet window (end is exclusive; the window may cross midnight). */
export function isQuietHour(atMs: number, quiet: QuietHours | null | undefined): boolean {
	if (!quiet) return false;
	const start = clockMinutes(quiet.start);
	const end = clockMinutes(quiet.end);
	if (start === end) return false;
	const now = zonedWallClock(atMs, quiet.tz);
	const current = now.hour * 60 + now.minute;
	return start < end ? current >= start && current < end : current >= start || current < end;
}
