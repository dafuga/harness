// @harness-uid u_7534zuwg3x
/** @pure Format a recorded instant in the reader's locale, retaining the caller's fallback. */
export function formatTime(
	instant: string | null,
	fallback: string = instant ?? 'Unknown',
	style: 'compact' | 'full' = 'compact'
): string {
	if (!instant || !Number.isFinite(Date.parse(instant))) return fallback;
	return new Date(instant).toLocaleString(
		undefined,
		style === 'full' ? undefined : { dateStyle: 'medium', timeStyle: 'short' }
	);
}

/** @pure Calendar labels and date-only values stay as recorded; timestamps use local time. */
export function timeLabel(recorded: string): string {
	return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(recorded) ? formatTime(recorded) : recorded;
}

/** @pure An instant for revision details, or the explicit Unknown label. */
export function displayTime(instant: string | null): string {
	return formatTime(instant, 'Unknown');
}
