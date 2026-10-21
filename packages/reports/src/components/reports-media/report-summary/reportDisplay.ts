export function dateLabel(value: string) {
	return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
