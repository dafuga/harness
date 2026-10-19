

/** JSON with object keys in sorted order at every depth: equal values give equal text. */
export function stableJson(value: unknown): string {
	if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
	if (!value || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
	const record = value as Record<string, unknown>;
	const fields = Object.keys(record)
		.filter((key) => record[key] !== undefined)
		.sort()
		.map((key) => JSON.stringify(key) + ':' + stableJson(record[key]));
	return '{' + fields.join(',') + '}';
}
