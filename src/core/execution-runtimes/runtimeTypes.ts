import type { RuntimeResponse } from './runtimeTypes.types';

export const defaultRuntimeTimeoutMs = 30_000;

export function runtimeFailure(code: string, message: string): RuntimeResponse {
	return { ok: false, error: { code, message } };
}

export function runtimeTimeout(timeoutMs: number): RuntimeResponse {
	return runtimeFailure('runtime-timeout', `no response within ${timeoutMs} ms`);
}

export type {
	RuntimeRequest,
	RuntimeFailure,
	RuntimeResponse,
	UnitRuntime,
	RuntimeOptions,
	RuntimeHandler,
	TransportFailure
} from './runtimeTypes.types';
