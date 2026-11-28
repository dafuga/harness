// @harness-uid u_2lqdb7qyy3
/** Drops a leading "Reminder Sat 10:00:" label: a reminder list already shows what and when. */
export function trackerReminderName(title: string): string {
	const label =
		/^\s*(?:(?:daily|weekly|monthly)\s+)?(?:personal\s+)?remind(?:er)?\b(?:[^:]|:(?=\d))*:\s+/i;
	return capitalized(title.replace(label, '').trim() || title);
}

/**
 * A personal row names only the thing to do. Bracketed asides (who asked, where details are
 * kept) and notes to Chief of Staff are left on the item.
 */
export function trackerPersonalName(title: string): string {
	let text = trackerReminderName(title);
	for (let previous = ''; previous !== text; ) {
		previous = text;
		text = text.replace(/\s*\([^()]*\)/g, '');
	}
	const bare = text
		.replace(/\s*\(.*$/s, '')
		.replace(/\s*(?:[.;]|\s[-–—])\s*CoS\b.*$/s, '')
		.replace(/[\s.;:,]+$/, '')
		.trim();
	return bare ? capitalized(bare) : 'Reminder';
}

function capitalized(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}
