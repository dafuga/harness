import type { Fields } from './kernelRequest.types';

export function isObject(value: unknown): value is Fields {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export { kernelRequest } from './impact-kernel/kernelRequest';

export type { Parsed } from './kernelRequest.types';
