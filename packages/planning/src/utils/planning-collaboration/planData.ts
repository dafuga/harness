import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import type { PlanningErrorCode } from '../../models/planning-collaboration/PlanningView.types';
export function planData(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(planData).join(',')}]`;
	if (value && typeof value === 'object')
		return `{${Object.entries(value)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => `${JSON.stringify(k)}:${planData(v)}`)
			.join(',')}}`;
	return JSON.stringify(value);
}
export const hash = (value: string | Uint8Array) =>
	createHash('sha256').update(value).digest('hex');
export function fail(code: PlanningErrorCode, message: string): never {
	throw Object.assign(new Error(message), { code, path: null });
}
export const json = (value: unknown) => `${planData(value)}\n`;
export const now = () => new Date().toISOString();
export function parse<T>(value: Uint8Array): T {
	try {
		return JSON.parse(Buffer.from(value).toString()) as T;
	} catch {
		return fail('artifact-corrupt', 'Invalid artifact JSON');
	}
}
