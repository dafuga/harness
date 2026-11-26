/** Local calendar date and HH:MM in the backup time zone. */
export function trackerBackupClock(now: number, timeZone: string) {
	const local = new Intl.DateTimeFormat('sv-SE', {
		timeZone,
		dateStyle: 'short',
		timeStyle: 'short'
	}).format(now);
	const [date, time] = local.split(' ');
	return { date, time };
}
