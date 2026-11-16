// @harness-uid u_i5bs2phohi
import type { Fields } from './kernelRequest.types';

export function isObject<Value>(value: Value): value is Value & Fields {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export { kernelRequest } from './impact-kernel/kernelRequest';

export type { Parsed } from './kernelRequest.types';
