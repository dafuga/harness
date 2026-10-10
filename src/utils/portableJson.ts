import { runtimeFailure, type RuntimeResponse } from '../core/runtimeTypes';

/** Deepest nesting of arrays and objects a request may have. */
export const maxJsonDepth = 64;

const loneSurrogate = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
const native = (String.prototype as { isWellFormed?: (this: string) => boolean }).isWellFormed;

/** Uses the engine's check where it exists; it is several times faster than the pattern. */
const wellFormed: (text: string) => boolean = native
	? (text) => native.call(text)
	: (text) => !loneSurrogate.test(text);

/**
 * True when a value means the same thing in every runtime: finite numbers, well-formed strings,
 * plain objects and arrays, and at most 64 levels of nesting. Anything else would be changed
 * or rejected somewhere between JavaScript, JSON text and a native JSON parser.
 */
export function portableJson(value: unknown, level = 0): boolean {
	if (typeof value === 'number') return Number.isFinite(value);
	if (typeof value === 'string') return wellFormed(value);
	if (value === null || typeof value === 'boolean') return true;
	if (typeof value !== 'object' || level >= maxJsonDepth) return false;
	return Array.isArray(value) ? portableItems(value, level + 1) : portableFields(value, level + 1);
}

/** Numbers and strings are checked in place: they are nearly every item of a large request. */
function portableItems(items: unknown[], level: number): boolean {
	for (let index = 0; index < items.length; index += 1) {
		const item = items[index];
		if (typeof item === 'number') {
			if (!Number.isFinite(item)) return false;
		} else if (typeof item === 'string') {
			if (!wellFormed(item)) return false;
		} else if (!portableJson(item, level)) return false;
	}
	return true;
}

/** An undefined property is the same as an absent one, exactly as JSON treats it. */
function portableFields(value: object, level: number): boolean {
	const prototype: unknown = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) return false;
	const fields = value as Record<string, unknown>;
	for (const key of Object.keys(fields)) {
		const item = fields[key];
		if (item === undefined) continue;
		if (!wellFormed(key) || !portableJson(item, level)) return false;
	}
	return true;
}

export const notPortable: RuntimeResponse = runtimeFailure(
	'invalid-json',
	'request is not valid JSON'
);
