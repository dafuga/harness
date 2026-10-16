type Value = null | boolean | number | string | Value[] | { [key: string]: Value };

function readable(value: Value, depth = 0): string {
	const compact = JSON.stringify(value, null, 2).replace(/\n\s*/g, '');
	if (compact.length <= 100 || depth >= 8 || value === null || typeof value !== 'object')
		return compact;
	const padding = '  '.repeat(depth + 1);
	const array = Array.isArray(value);
	const lines = array
		? value.map((item) => `${padding}${readable(item, depth + 1)}`)
		: Object.entries(value).map(
				([key, item]) => `${padding}${JSON.stringify(key)}: ${readable(item, depth + 1)}`
			);
	return `${array ? '[' : '{'}\n${lines.join(',\n')}\n${'  '.repeat(depth)}${array ? ']' : '}'}`;
}

/** Formats the JSON that was recorded, keeping short arrays and records together. */
export function compactRecordedValue(value: unknown): string {
	const recorded = JSON.stringify(value);
	return recorded === undefined ? 'Not recorded' : readable(JSON.parse(recorded));
}
