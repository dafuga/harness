// @harness-uid u_bl6xl2h4a3
import { trackerTimeZone } from './normalizeTrackerDue';

const opensAt = 8;
const closesAt = 22;
const minute = 60_000;

/** @pure When today's 08:00 to 22:00 Lisbon send window opened, or null during the night hold. */
export function cosSendWindowStart(now: number): number | null {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: trackerTimeZone,
		hour: 'numeric',
		minute: 'numeric',
		hourCycle: 'h23'
	}).formatToParts(now);
	const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
	const hour = read('hour');
	if (hour < opensAt || hour >= closesAt) return null;
	return now - ((hour - opensAt) * 60 + read('minute')) * minute - (now % minute);
}
