import type { RuntimeKind } from '../development-tooling/unitTypes';

/** One call to a unit, whatever runtime carries it. */
export interface RuntimeRequest {
	operation: string;
	input?: unknown;
}

export interface RuntimeFailure {
	code: string;
	message: string;
}

/** Success with an output, or a failure with a stable code; transports never throw. */
export type RuntimeResponse = { ok: true; output: unknown } | { ok: false; error: RuntimeFailure };

/** The single typed contract every execution target implements. */
export interface UnitRuntime {
	readonly kind: RuntimeKind;
	invoke(request: RuntimeRequest): Promise<RuntimeResponse>;
	close(): Promise<void>;
}

export interface RuntimeOptions {
	/**
	 * Longest a call may take. A response that arrives later is discarded and the call fails with
	 * `runtime-timeout`. Process and HTTP targets are stopped at the deadline. Module and Wasm
	 * targets run on the calling thread and cannot be interrupted: the call still occupies the
	 * thread until it returns, and only then is the late result rejected. Use a process target
	 * when a hard limit is required.
	 */
	timeoutMs?: number;
}

export type RuntimeHandler = (
	request: RuntimeRequest
) => RuntimeResponse | Promise<RuntimeResponse>;

/** Failure codes raised by the transport rather than by the unit itself. */
export type TransportFailure =
	| 'runtime-unavailable'
	| 'runtime-failed'
	| 'runtime-timeout'
	| 'invalid-response';
