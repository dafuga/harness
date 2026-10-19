import type { Region } from '../models/Desktop.types';
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
export function regionField(value: unknown): Region | null {
	if (value === null) return null;
	const r = ipcFields(value);
	const points = ['x', 'y', 'width', 'height'].map((k) => r[k]);
	if (!points.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1))
		throw new Error('Invalid image region.');
	const region = r as unknown as Region;
	if (
		!region.width ||
		!region.height ||
		region.x + region.width > 1.000001 ||
		region.y + region.height > 1.000001
	)
		throw new Error('Image region is outside the image.');
	return { x: region.x, y: region.y, width: region.width, height: region.height };
}
