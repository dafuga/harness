// @harness-uid u_nz6sw6sbnv

/** @pure How long an ask has waited, in the largest whole unit. */
export function waitAge(since: string, now: number) {
	const minutes = Math.max(0, Math.floor((now - Date.parse(since)) / 60_000));
	if (minutes < 60) return `${minutes}m`;
	return minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
}
