const stamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** A recorded instant in the reader's own time; anything else is shown as it was recorded. */
export function timeLabel(value: string): string {
	if (!stamp.test(value)) return value;
	const time = new Date(value);
	return Number.isNaN(time.getTime())
		? value
		: time.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
