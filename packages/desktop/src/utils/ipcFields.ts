export function ipcFields(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Expected an object.');
	return value as Record<string, unknown>;
}

export function textField(value: unknown, max = 300, pattern?: RegExp): string {
	if (typeof value !== 'string' || !value.trim() || value.length > max)
		throw new Error('Invalid text field.');
	if (pattern && !pattern.test(value)) throw new Error('Invalid identifier.');
	return value;
}

export function nullableText(value: unknown, pattern?: RegExp): string | null {
	return value === null ? null : textField(value, 300, pattern);
}

export const hashPattern = /^[a-f0-9]{64}$/;

export const commitPattern = /^[a-f0-9]{40}$/;

export const idPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export const versionPattern = /^v\d{3,}$/;

export function enumField<T extends string>(value: unknown, allowed: readonly T[]): T {
	if (!allowed.includes(value as T)) throw new Error('Invalid option.');
	return value as T;
}

export { regionField } from './ipc-payload/regionField';
