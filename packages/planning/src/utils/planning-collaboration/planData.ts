// @harness-uid u_jhkmgylw3b
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
/** A planning operation refused with a stable code; `path` is null until a caller attaches one. */
export class PlanningError extends Error {
	code: PlanningErrorCode;
	path: string | null = null;

	constructor(code: PlanningErrorCode, message: string) {
		super(message);
		this.code = code;
	}
}
export function fail(code: PlanningErrorCode, message: string): never {
	throw new PlanningError(code, message);
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
