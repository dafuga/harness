/** Whether a value is a text of a pattern. A global pattern keeps no position between calls. */
export function matchesPattern(value: unknown, pattern: RegExp): value is string {
	if (typeof value !== 'string') return false;
	pattern.lastIndex = 0;
	const matched = pattern.test(value);
	pattern.lastIndex = 0;
	return matched;
}
