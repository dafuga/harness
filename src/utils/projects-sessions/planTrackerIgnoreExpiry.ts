// @harness-uid u_h5qlvks3hh
import type { TrackerItemClock, TrackerItemFields } from './normalizeTrackerItemFields.types';
import type { TrackerIgnoredItem } from './planTrackerIgnoreExpiry.types';
import { wallClockToEpochMs } from '../../helpers/attention-timing/wallClockToEpochMs';
import { trackerTimeZone } from './normalizeTrackerDue';
import { planTrackerItemMutation } from './planTrackerItemMutation';

/** The unignore write for an ignored item whose `ignored_until` has passed; a date ends as it starts in the Tracker zone. */
export function planTrackerIgnoreExpiry(
	item: TrackerIgnoredItem,
	clock: TrackerItemClock
): TrackerItemFields | undefined {
	if (item.status !== 'ignored' || !ignoreEnded(item.ignored_until, clock)) return undefined;
	const { fields } = planTrackerItemMutation(
		{ action: 'unignore', item },
		{ ...clock, candidates: [] }
	);
	return { ...fields, 'note+': `ignore expired; back to ${fields.status}` };
}

function ignoreEnded(
	until: string | null | undefined,
	{ now, timeZone = trackerTimeZone }: TrackerItemClock
): boolean {
	if (!until) return false;
	const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(until);
	if (!date) return Date.parse(until) <= now;
	const [, year, month, day] = date.map(Number);
	return wallClockToEpochMs({ year, month, day, hour: 0, minute: 0 }, timeZone) <= now;
}
