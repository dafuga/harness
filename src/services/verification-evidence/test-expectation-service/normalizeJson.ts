export function normalizeJson(value: unknown, path: string): void {
	const parts = pathParts(path);
	let parent = value;
	for (const part of parts.slice(0, -1)) {
		if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, part))
			throw new Error(`Missing normalization field ${path}`);
		parent = (parent as Record<string, unknown>)[part];
	}
	const key = parts.at(-1)!;
	if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, key))
		throw new Error(`Missing normalization field ${path}`);
	const record = parent as Record<string, unknown>;
	if (record[key] === null || typeof record[key] === 'object')
		throw new Error(`Normalization must name a scalar field: ${path}`);
	record[key] = { normalizedType: typeof record[key] };
}
function pathParts(path: string): string[] {
	const parts = path.split('.');
	if (parts.some((part) => !part || ['__proto__', 'prototype', 'constructor', '*'].includes(part)))
		throw new Error(`Invalid normalization path ${path}`);
	return parts;
}
