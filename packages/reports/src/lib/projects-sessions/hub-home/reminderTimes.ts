// @harness-uid u_xh5ezxybkq
const hour = 3_600_000;

const dayLabel = (at: Date) =>
	new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
		.format(at)
		.replace(',', '');

const clockLabel = (at: Date) =>
	new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(at);

/** Calendar days later at the same local clock time, so a clock change does not shift it. */
function daysLater(now: number, days: number): Date {
	const at = new Date(now);
	at.setDate(at.getDate() + days);
	return at;
}

function relativeDay(at: Date, now: number): string {
	const day = dayLabel(at);
	if (day === dayLabel(new Date(now))) return 'Today';
	return day === dayLabel(daysLater(now, 1)) ? 'Tomorrow' : day;
}

/** @pure When a reminder fires next, in the viewer's own time zone. A passed time is due now. */
export function reminderNextTime(at: string, now: number): { due: boolean; label: string } {
	const time = new Date(at);
	const due = time.getTime() <= now;
	return { due, label: due ? 'Due now' : `${relativeDay(time, now)} ${clockLabel(time)}` };
}

/** @pure The three snoozes offered: an hour, tomorrow morning and a week. */
export function snoozeChoices(now: number): { label: string; until: string }[] {
	const morning = daysLater(now, 1);
	morning.setHours(9, 0, 0, 0);
	return [
		{ label: '1 hour', until: new Date(now + hour).toISOString() },
		{ label: 'Tomorrow 09:00', until: morning.toISOString() },
		{ label: '1 week', until: daysLater(now, 7).toISOString() }
	];
}
