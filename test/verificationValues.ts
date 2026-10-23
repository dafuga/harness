import type { ObservationValue, State } from './verificationValues.types';
import { createHash } from 'node:crypto';
import { types } from 'node:util';
const typedArray = Object.getPrototypeOf(Uint8Array.prototype);
function intrinsic(target: object, prototype: object, key: string): unknown {
	return Reflect.apply(Object.getOwnPropertyDescriptor(prototype, key)!.get!, target, []);
}
function bytes(value: ArrayBufferView): ObservationValue {
	const prototype = types.isDataView(value) ? DataView.prototype : typedArray;
	const view = new Uint8Array(
		intrinsic(value, prototype, 'buffer') as ArrayBuffer,
		intrinsic(value, prototype, 'byteOffset') as number,
		intrinsic(value, prototype, 'byteLength') as number
	);
	return {
		type: 'bytes',
		length: view.byteLength,
		sha256: createHash('sha256').update(view).digest('hex')
	};
}
function special(value: object): ObservationValue | undefined {
	if (ArrayBuffer.isView(value)) return bytes(value);
	if (types.isAnyArrayBuffer(value)) return bytes(new Uint8Array(value));
	if (types.isRegExp(value))
		return {
			type: 'regexp',
			source: intrinsic(value, RegExp.prototype, 'source') as string,
			flags: ['hasIndices', 'global', 'ignoreCase', 'multiline', 'dotAll', 'unicode', 'sticky']
				.filter((flag) => intrinsic(value, RegExp.prototype, flag))
				.join(',')
		};
	return undefined;
}
function primitive(value: unknown): ObservationValue | undefined {
	if (value === null || typeof value === 'boolean') return value;
	if (typeof value === 'string')
		return value.length <= 2000 ? value : `${value.slice(0, 2000)}…[${value.length} characters]`;
	if (typeof value === 'number')
		return Number.isFinite(value) ? value : { type: 'number', value: String(value) };
	if (typeof value !== 'object') return { type: typeof value };
	return undefined;
}
function readable(value: object, descriptors: PropertyDescriptorMap): boolean {
	const proto = Object.getPrototypeOf(value);
	return (
		Array.isArray(value) ||
		proto === Object.prototype ||
		proto === null ||
		types.isNativeError(value) ||
		descriptors.$$typeof?.value === Symbol.for('jest.asymmetricMatcher')
	);
}
function fields(value: object, state: State): ObservationValue {
	const descriptors = Object.getOwnPropertyDescriptors(value);
	if (!readable(value, descriptors)) return { type: 'opaque-object' };
	const keys = Object.keys(descriptors)
		.filter((key) => key !== 'stack' && key !== 'length')
		.sort();
	const output: Record<string, ObservationValue> = Object.create(null);
	for (const key of keys.slice(0, 30)) {
		const descriptor = descriptors[key];
		output[key.slice(0, 200)] =
			'value' in descriptor
				? observationValue(descriptor.value, state.depth + 1, state.seen, state.budget)
				: { type: 'accessor' };
	}
	if (keys.length > 30) output.$omitted = keys.length - 30;
	return Array.isArray(value) ? { type: 'array', length: value.length, entries: output } : output;
}
/** Never call getters, toJSON, custom inspectors or user-defined prototype methods. */
export function observationValue(
	value: unknown,
	depth = 0,
	seen = new WeakSet<object>(),
	budget = { remaining: 200 }
): ObservationValue {
	if (--budget.remaining < 0) return { type: 'size-limit' };
	const plain = primitive(value);
	if (plain !== undefined) return plain;
	const object = value as object;
	if (types.isProxy(object)) return { type: 'opaque-proxy' };
	const encoded = special(object);
	if (encoded !== undefined) return encoded;
	if (seen.has(object)) return { type: 'circular' };
	if (depth >= 4) return { type: 'depth-limit' };
	seen.add(object);
	return fields(object, { depth, seen, budget });
}

export type { ObservationValue } from './verificationValues.types';
