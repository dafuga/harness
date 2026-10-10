import { kernelContract } from '../core/kernelTypes';
import { runtimeFailure, type RuntimeResponse } from '../core/runtimeTypes';
import { kernelClosure } from './kernelClosure';
import { isObject, kernelRequest } from './kernelRequest';
import { notPortable, portableJson } from './portableJson';

/**
 * TypeScript reference of the impact kernel; the Rust kernel must match it exactly.
 * A request that is not portable JSON is refused as `invalid-json` before anything else.
 */
export function impactKernel(request: unknown): RuntimeResponse {
	return portableJson(request) ? impactKernelPortable(request) : notPortable;
}

/** The kernel proper, for a caller that has already established the request is portable. */
export function impactKernelPortable(request: unknown): RuntimeResponse {
	if (!isObject(request) || typeof request.operation !== 'string') {
		return runtimeFailure('invalid-request', 'request must be an object with an operation');
	}
	if (request.operation === 'version') return { ok: true, output: { contract: kernelContract } };
	if (request.operation !== 'impact') {
		return runtimeFailure('unknown-operation', `operation "${request.operation}" is not supported`);
	}
	const parsed = kernelRequest(request.input);
	if ('error' in parsed) return { ok: false, error: parsed.error };
	return { ok: true, output: kernelClosure(parsed.value) };
}

/** The same kernel over JSON text, as byte transports see it. */
export function impactKernelText(text: string): string {
	let request: unknown;
	try {
		request = JSON.parse(text);
	} catch {
		return JSON.stringify(notPortable);
	}
	return JSON.stringify(impactKernel(request));
}
