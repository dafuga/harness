import type { RuntimeFailure } from '../../core/execution-runtimes/runtimeTypes';

export type Parsed<T> = { value: T } | { error: RuntimeFailure };

type Fields = Record<string, unknown>;

export function isObject(value: unknown): value is Fields {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export { kernelRequest } from './impact-kernel/kernelRequest';
