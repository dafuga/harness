/** JSON with object keys sorted at every depth, so equal values always serialize identically. */
export function canonicalJson(value: unknown): string {
	return JSON.stringify(sorted(value));
}

function sorted(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sorted);
	if (value === null || typeof value !== 'object') return value;
	const fields = value as Record<string, unknown>;
	const keys = Object.keys(fields)
		.filter((key) => fields[key] !== undefined)
		.sort();
	return Object.fromEntries(keys.map((key) => [key, sorted(fields[key])]));
}
