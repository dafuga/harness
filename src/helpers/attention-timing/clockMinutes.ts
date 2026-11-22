// @harness-uid u_rycmpfjeif
/** @pure Minutes after midnight for an "HH:MM" wall-clock time; throws on any other text. */
export function clockMinutes(clock: string): number {
	const match = /^(\d{1,2}):(\d{2})$/.exec(String(clock));
	if (!match) throw new RangeError(`bad time "${clock}", expected HH:MM`);
	return Number(match[1]) * 60 + Number(match[2]);
}
