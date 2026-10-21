import {
	defaultRuntimeTimeoutMs,
	runtimeFailure,
	runtimeTimeout,
	type RuntimeOptions,
	type RuntimeRequest,
	type RuntimeResponse,
	type UnitRuntime
} from '../../core/execution-runtimes/runtimeTypes';
import { notPortable, portableJson } from '../../utils/development-tooling/portableJson';
import {
	runtimeDeadline,
	runtimeResponseText
} from '../../utils/execution-runtimes/runtimeResponse';

/** Calls a unit that is served independently over HTTP: one JSON request per POST. */
export class HttpRuntimeAdapter implements UnitRuntime {
	readonly kind = 'http' as const;
	private readonly timeoutMs: number;

	constructor(
		private readonly url: string,
		options: RuntimeOptions = {}
	) {
		this.timeoutMs = options.timeoutMs ?? defaultRuntimeTimeoutMs;
	}

	async invoke(request: RuntimeRequest): Promise<RuntimeResponse> {
		if (!portableJson(request)) return notPortable;
		const deadline = runtimeDeadline(this.timeoutMs);
		return deadline.settle(await this.post(request));
	}

	private async post(request: RuntimeRequest): Promise<RuntimeResponse> {
		try {
			const response = await fetch(this.url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(request),
				signal: AbortSignal.timeout(this.timeoutMs)
			});
			return this.read(response.status, await response.text());
		} catch (error) {
			return this.failure(error);
		}
	}

	close(): Promise<void> {
		return Promise.resolve();
	}

	/** A unit may answer a refused request with a non-2xx status and a valid envelope. */
	private read(status: number, body: string): RuntimeResponse {
		const parsed = runtimeResponseText(body);
		const envelope = parsed.ok || parsed.error.code !== 'invalid-response';
		if (envelope || (status >= 200 && status < 300)) return parsed;
		return runtimeFailure('runtime-failed', `HTTP ${status}: ${body.slice(0, 200)}`);
	}

	private failure(error: unknown): RuntimeResponse {
		const name = error instanceof Error ? error.name : '';
		if (name === 'TimeoutError' || name === 'AbortError') {
			return runtimeTimeout(this.timeoutMs);
		}
		const message = error instanceof Error ? error.message : String(error);
		return runtimeFailure('runtime-unavailable', `cannot reach ${this.url}: ${message}`);
	}
}
