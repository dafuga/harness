// @harness-uid u_5ujwyb3myc
export function timeAgo(
	value: string,
	now = Date.now(),
	numeric: Intl.RelativeTimeFormatNumeric = 'auto'
) {
	const elapsed = now - Date.parse(value);
	if (!Number.isFinite(elapsed)) return '';
	if (elapsed < 60_000) return 'just now';
	const units: [Intl.RelativeTimeFormatUnit, number][] = [
		['year', 365 * 24 * 60 * 60_000],
		['month', 30 * 24 * 60 * 60_000],
		['week', 7 * 24 * 60 * 60_000],
		['day', 24 * 60 * 60_000],
		['hour', 60 * 60_000],
		['minute', 60_000]
	];
	const [unit, duration] = units.find(([, duration]) => elapsed >= duration)!;
	return new Intl.RelativeTimeFormat('en', { numeric }).format(
		-Math.floor(elapsed / duration),
		unit
	);
}
