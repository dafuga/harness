/** Recorded measures are shown as recorded; a measure that was not taken says so instead of being estimated. */
const notTaken = { available: false, text: '' };
const variants: Record<string, Record<string, unknown>> = {
	'not-measured': { size: notTaken, performance: notTaken },
	mixed: { size: { available: true, text: '2 KB' }, performance: notTaken }
};
export function measuresPanelVariantProps<T extends object>(props: T, variant: string) {
	const changed = variants[variant];
	return changed ? { ...props, ...changed } : props;
}
