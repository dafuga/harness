// @harness-uid u_dlnkn6pc2p
import type { TrackerItemRow } from '../TrackerItemReadRepository.types';
import { trackerClockMilliseconds } from '../../../utils/projects-sessions/nextTrackerClock';
const formatters = new Map<string, Intl.DateTimeFormat>();

/** Format an instant as 'YYYY-MM-DD HH:MM' on the given time zone's clock. */
export function stampTrackerTime(ms: number, timeZone: string): string {
	let formatter = formatters.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
		formatters.set(timeZone, formatter);
	}
	const { year, month, day, hour, minute } = Object.fromEntries(
		formatter.formatToParts(ms).map(({ type, value }) => [type, value])
	);
	return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function launchRequestedAt(row: TrackerItemRow, now: number) {
	const { auto } = JSON.parse(row.clocks) as { auto?: string };
	return trackerClockMilliseconds(auto ?? '') || Date.parse(row.updated_at ?? '') || now;
}
