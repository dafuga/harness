// @harness-uid u_okueohjk4j
const scheduleZone = 'Europe/Lisbon';
const scheduleDay = new Intl.DateTimeFormat('en-GB', {
	weekday: 'short',
	day: 'numeric',
	month: 'short',
	timeZone: scheduleZone
});
const scheduleTime = new Intl.DateTimeFormat('en-GB', {
	hour: '2-digit',
	minute: '2-digit',
	timeZone: scheduleZone
});

export function runDay(at: string, now: number) {
	const day = scheduleDay.format(new Date(at)).replace(',', '');
	if (day === scheduleDay.format(now).replace(',', '')) return 'Today';
	return day === scheduleDay.format(now + 86400000).replace(',', '') ? 'Tomorrow' : day;
}

export function runTime(at: string) {
	return scheduleTime.format(new Date(at));
}

const momentDay = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	timeZone: scheduleZone
});

export function runMoment(at: string): string {
	return `${momentDay.format(new Date(at))} ${runTime(at)}`;
}

export function when(time: string) {
	return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
		new Date(time)
	);
}

export function quotaReset(time: string | null, now: number) {
	if (!time) return 'Reset time unknown';
	const minutes = Math.max(0, Math.ceil((Date.parse(time) - now) / 60000));
	if (!minutes) return 'Reset due';
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	let span = `${minutes}m`;
	if (hours) span = days ? `${days}d ${hours % 24}h` : `${hours}h ${minutes % 60}m`;
	const clock = days ? `${scheduleWeekday.format(new Date(time))} ${runTime(time)}` : runTime(time);
	return `Resets ${clock} · in ${span}`;
}

const scheduleWeekday = new Intl.DateTimeFormat('en-GB', {
	weekday: 'short',
	timeZone: scheduleZone
});

/** The day and Lisbon clock time a used-up limit comes back. */
export function resetClock(time: string | null, now: number) {
	if (!time) return 'reset time unknown';
	if (Date.parse(time) <= now) return 'reset due';
	const day = scheduleDay.format(new Date(time)).replace(',', '');
	return `resets ${day} ${runTime(time)} Lisbon`;
}
