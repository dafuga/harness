// @harness-uid u_xh5ezxybkq
import { wallClockToEpochMs } from '../../../../../../src/helpers/attention-timing/wallClockToEpochMs';
import {
	trackerDateFormatter,
	trackerDateParts,
	trackerTimeZone
} from '../../../../../../src/utils/projects-sessions/normalizeTrackerDue';
import type { HomeReminder } from './hubHome.types';

const lisbon = (options: Intl.DateTimeFormatOptions) =>
	new Intl.DateTimeFormat('en-GB', { ...options, timeZone: trackerTimeZone });

const dayLabel = (at: Date) =>
	lisbon({ weekday: 'short', day: 'numeric', month: 'short' }).format(at).replace(',', '');

const clockLabel = (at: Date) => lisbon({ hour: '2-digit', minute: '2-digit' }).format(at);

/** 09:00 in Lisbon, this many Lisbon calendar days later. */
function morning(now: number, days: number): Date {
	const today = trackerDateParts(now, trackerDateFormatter(trackerTimeZone));
	const wall = { ...today, day: today.day + days, hour: 9, minute: 0 };
	return new Date(wallClockToEpochMs(wall, trackerTimeZone));
}

function relativeDay(at: Date, now: number): string {
	const day = dayLabel(at);
	if (day === dayLabel(new Date(now))) return 'Today';
	return day === dayLabel(morning(now, 1)) ? 'Tomorrow' : day;
}

function stamp(at: string, now: number, allDay?: boolean): string {
	const time = new Date(at);
	const day = relativeDay(time, now);
	return allDay ? day : `${day} ${clockLabel(time)}`;
}

/**
 * @pure A reminder's day and time in Lisbon. `due` marks a passed time as overdue. A row listed
 * by its deadline reads "Due …"; a row listed by an earlier or later reminder adds the deadline.
 */
export function reminderNextTime(
	reminder: Pick<HomeReminder, 'at' | 'due' | 'allDay'>,
	now: number
): { due: boolean; label: string; deadline: string | null } {
	const { at, due, allDay } = reminder;
	const overdue = Date.parse(at) <= now;
	const deadline = due === at;
	const when = stamp(at, now, deadline && allDay);
	const plain = deadline ? `Due ${when}` : when;
	return {
		due: overdue,
		label: overdue ? `Overdue · ${when}` : plain,
		deadline: due && !deadline ? `Due ${stamp(due, now, allDay)}` : null
	};
}

/** @pure The two snoozes offered: tomorrow morning and a week from today, in Lisbon. */
export function snoozeChoices(now: number): { label: string; until: string }[] {
	return [
		{ label: 'Tomorrow 09:00', until: morning(now, 1).toISOString() },
		{ label: 'Next week', until: morning(now, 7).toISOString() }
	];
}
