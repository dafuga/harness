// @harness-uid u_iyhps4wxee
const macros: Readonly<Record<string, string>> = {
	'@hourly': 'Hourly',
	'@daily': 'Daily',
	'@midnight': 'Daily',
	'@weekly': 'Weekly',
	'@monthly': 'Monthly',
	'@yearly': 'Yearly',
	'@annually': 'Yearly'
};

/** Day-of-month, month and day-of-week of a schedule with one fixed time of day. */
const shapes: readonly (readonly [RegExp, string])[] = [
	[/^\* \* \*$/, 'Daily'],
	[/^\* \* (?:\d|[a-z]{3})$/, 'Weekly'],
	[/^\d+ \* \*$/, 'Monthly']
];

/** How often a schedule repeats, in one word. The next time is shown next to it. */
export function trackerRepeatLabel(every: string | null | undefined): string | null {
	const text = (every ?? '').trim().toLowerCase().split(/\s+/).join(' ');
	if (!text) return null;
	const days = /^\d+ \d+ (.*)$/.exec(text)?.[1] ?? '';
	return macros[text] ?? shapes.find(([shape]) => shape.test(days))?.[1] ?? 'Repeats';
}
