// @harness-uid u_ljgh67kaav
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMs = 86_400_000;

/** The usage process runs in UTC. An unfamiliar clock or zone stays unknown. */
export function claudeResetTime(line: string, now: number): string | null {
	const match =
		/^Resets\s+(?:(\w{3}) (\d{1,2})(?:,| at)? )?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?: \((?:Etc\/)?UTC\))?$/i.exec(
			line
		);
	if (!match) return null;
	const [, month, day, clock, minute = '00', meridiem] = match;
	const hour = Number(clock);
	if (hour < 1 || hour > 12 || Number(minute) > 59) return null;
	const hour24 = (hour % 12) + (meridiem.toLowerCase() === 'pm' ? 12 : 0);
	return resetDate(month, Number(day), (hour24 * 60 + Number(minute)) * 60_000, now);
}

function resetDate(month: string | undefined, day: number, clockMs: number, now: number) {
	const date = new Date(now);
	const year = date.getUTCFullYear();
	if (!month) {
		const today = Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) + clockMs;
		return new Date(today + (today + 59_999 < now ? dayMs : 0)).toISOString();
	}
	const index = months.findIndex((name) => name.toLowerCase() === month.toLowerCase());
	if (index < 0 || day < 1 || day > 31) return null;
	const resetYear = date.getUTCMonth() === 11 && index === 0 ? year + 1 : year;
	const reset = new Date(Date.UTC(resetYear, index, day) + clockMs);
	return reset.getUTCDate() === day ? reset.toISOString() : null;
}
