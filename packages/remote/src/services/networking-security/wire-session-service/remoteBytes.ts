// @harness-uid u_dilltr2si4
import type { WireRequest } from '../../../models/networking-security/Remote.types';

/** JSON with object keys in sorted order at every depth: equal values give equal text. */
export function stableJson(value: WireRequest['input']): string {
	return stableJsonValue(value);
}

function stableJsonValue(value: unknown): string {
	if (Array.isArray(value)) return '[' + value.map(stableJsonValue).join(',') + ']';
	if (!value || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
	const record = value as Record<string, unknown>;
	const fields = Object.keys(record)
		.filter((key) => record[key] !== undefined)
		.sort()
		.map((key) => JSON.stringify(key) + ':' + stableJsonValue(record[key]));
	return '{' + fields.join(',') + '}';
}
