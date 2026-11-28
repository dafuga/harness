// @harness-uid u_brjohnzsom
import { wallClockToEpochMs } from '../../helpers/attention-timing/wallClockToEpochMs';
import { trackerTimeZone } from './normalizeTrackerDue';
import { trackerRepeatLabel } from './trackerRepeatLabel';
import type { TrackerReminderSource, TrackerReminderTime } from './trackerUpcomingReminder.types';

/** How far ahead an item counts as upcoming. A passed one is listed however old it is. */
const horizon = 14 * 86_400_000;

/** Daniel's own life: these agents' dated items are listed under Personal. */
const personalGroup =
	/^(?:personal(?:$|[-_ ])|(?:dad|family|doc|claire|boating|coach|life[-_ ]?coach)$)/i;

/**
 * Which Reminders group an open item belongs to, whenever it is due. A personal agent's item
 * is personal. Other work counts only when it is Daniel's to do: a reminder or an item Daniel
 * owns. An auto-launched item's due time is an agent's ETA, and a recurring job is run for Daniel.
 */
export function trackerReminderGroup(item: TrackerReminderSource): 'work' | 'personal' | undefined {
	const { status, kind, agent, autoLaunch } = item;
	if (status === 'done' || status === 'ignored' || kind === 'recurring') return undefined;
	if (personalGroup.test((agent ?? '').trim())) return 'personal';
	return !autoLaunch && forDaniel(item) ? 'work' : undefined;
}

function forDaniel({ kind, title, owner }: TrackerReminderSource): boolean {
	return (
		kind === 'reminder' ||
		/^\s*remind(?:er)?\b/i.test(title ?? '') ||
		/^daniel(?: fugere)?$/i.test((owner ?? '').trim())
	);
}

/** A due day without a clock time lasts until the end of that day in Lisbon. */
function instant(value: string | null | undefined): { ms: number; allDay: boolean } | undefined {
	const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
	if (day) {
		const [year, month, date] = day.slice(1).map(Number);
		const wall = { year, month, day: date, hour: 23, minute: 59 };
		return { ms: wallClockToEpochMs(wall, trackerTimeZone), allDay: true };
	}
	const ms = Date.parse(value ?? '');
	return Number.isNaN(ms) ? undefined : { ms, allDay: false };
}

/**
 * The time a row is listed by: a coming reminder (so a snooze moves the row), else a coming due
 * time, else the passed one. A repeating reminder always shows its armed time, which Done names.
 */
function listedTime(item: TrackerReminderSource, now: number) {
	const remind = instant(item.remindAt);
	const due = instant(item.due);
	if (remind && (item.every || remind.ms > now)) return { time: remind, due };
	if (due && due.ms > now) return { time: due, due };
	return { time: due ?? remind, due };
}

/** When an open item shows under Upcoming reminders, or nothing when it does not. */
export function trackerUpcomingReminder(
	item: TrackerReminderSource,
	now: number
): TrackerReminderTime | undefined {
	const group = trackerReminderGroup(item);
	if (!group) return undefined;
	const { time, due } = listedTime(item, now);
	if (!time || time.ms > now + horizon) return undefined;
	return {
		at: new Date(time.ms).toISOString(),
		repeats: trackerRepeatLabel(item.every),
		group,
		...(due && { due: new Date(due.ms).toISOString() }),
		...(due?.allDay && { allDay: true as const })
	};
}
