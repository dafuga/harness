function canonical(value: unknown): string {
	if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
	if (!value || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
	const record = value as Record<string, unknown>;
	const fields = Object.keys(record)
		.filter((key) => record[key] !== undefined)
		.sort()
		.map((key) => JSON.stringify(key) + ':' + canonical(record[key]));
	return '{' + fields.join(',') + '}';
}

/**
 * Hex SHA-256 of the canonical signed entry, which the next entry names as `prev`. The same bytes
 * as `chainEntryHash` of the sealed core, which a test holds this function to.
 */
export async function chainHash(entry: Record<string, unknown>): Promise<string> {
	const { seq, prev, at, by, body, sig } = entry;
	const bytes = new TextEncoder().encode(canonical({ seq, prev, at, by, body, sig }));
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
	return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
