// @harness-uid u_g7qynp3ayq
/** Whether a value is a text of a pattern. A global pattern keeps no position between calls. */
export function matchesPattern<T>(value: T, pattern: RegExp): value is T & string {
	if (typeof value !== 'string') return false;
	pattern.lastIndex = 0;
	const matched = pattern.test(value);
	pattern.lastIndex = 0;
	return matched;
}
