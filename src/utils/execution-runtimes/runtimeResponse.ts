import {
	runtimeFailure,
	runtimeTimeout,
	type RuntimeResponse
} from '../../core/execution-runtimes/runtimeTypes';

/** Accepts only a well-formed response envelope; anything else is an `invalid-response`. */
export function runtimeResponse(value: unknown): RuntimeResponse {
	if (isEnvelope(value)) return value;
	return runtimeFailure(
		'invalid-response',
		'runtime returned a value that is not a response envelope'
	);
}

/** Parses the text a byte transport returned. */
export function runtimeResponseText(text: string): RuntimeResponse {
	try {
		return runtimeResponse(JSON.parse(text));
	} catch {
		return runtimeFailure('invalid-response', 'runtime returned text that is not JSON');
	}
}

function isEnvelope(value: unknown): value is RuntimeResponse {
	if (typeof value !== 'object' || value === null) return false;
	const envelope = value as { ok?: unknown; output?: unknown; error?: unknown };
	if (envelope.ok === true) return 'output' in envelope;
	const error = envelope.error as { code?: unknown; message?: unknown } | undefined;
	return (
		envelope.ok === false && typeof error?.code === 'string' && typeof error.message === 'string'
	);
}

export interface RuntimeDeadline {
	/** Resolves with a timeout failure once the deadline passes, if a timer can fire. */
	expired: Promise<RuntimeResponse>;
	/** Returns the response, or a timeout failure when it arrived after the deadline. */
	settle(response: RuntimeResponse): RuntimeResponse;
}

/**
 * Starts the clock for one call. The timer covers work that yields; `settle` covers work that
 * blocked the thread, where no timer could fire before the result was ready.
 */
export function runtimeDeadline(timeoutMs: number): RuntimeDeadline {
	const started = performance.now();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const expired = new Promise<RuntimeResponse>((resolve) => {
		timer = setTimeout(() => resolve(runtimeTimeout(timeoutMs)), timeoutMs);
	});
	return {
		expired,
		settle(response) {
			clearTimeout(timer);
			return performance.now() - started > timeoutMs ? runtimeTimeout(timeoutMs) : response;
		}
	};
}
