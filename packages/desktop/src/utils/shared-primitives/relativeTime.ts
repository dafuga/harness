const units: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 31_536_000_000],
	['month', 2_592_000_000],
	['week', 604_800_000],
	['day', 86_400_000],
	['hour', 3_600_000],
	['minute', 60_000]
];

/** @pure A recorded instant as a short relative date ("3 days ago"), or Unknown when it is absent. */
export function relativeTime(instant: string | null | undefined, now: number = Date.now()): string {
	const time = instant ? Date.parse(instant) : Number.NaN;
	if (!Number.isFinite(time)) return 'Unknown';
	const elapsed = time - now;
	const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
	for (const [unit, size] of units) {
		if (Math.abs(elapsed) >= size) return format.format(Math.round(elapsed / size), unit);
	}
	return format.format(Math.round(elapsed / 1000), 'second');
}
