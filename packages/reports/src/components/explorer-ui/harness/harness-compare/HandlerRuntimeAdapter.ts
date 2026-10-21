import {
	defaultRuntimeTimeoutMs,
	runtimeFailure,
	type RuntimeHandler,
	type RuntimeOptions,
	type RuntimeRequest,
	type RuntimeResponse,
	type UnitRuntime
} from '../../../../../../../src/core/runtimeTypes';
import { notPortable, portableJson } from '../../../../../../../src/utils/portableJson';
import { runtimeDeadline, runtimeResponse } from '../../../../../../../src/utils/runtimeResponse';

/**
 * Runs a unit in the calling isolate by invoking a handler function. It uses nothing but the
 * language and standard web globals, so it behaves the same under Bun, Node and Workers.
 */
export class HandlerRuntimeAdapter implements UnitRuntime {
	readonly kind = 'module' as const;
	private readonly timeoutMs: number;

	constructor(
		private readonly handler: RuntimeHandler,
		options: RuntimeOptions = {}
	) {
		this.timeoutMs = options.timeoutMs ?? defaultRuntimeTimeoutMs;
	}

	/** A handler that blocks the thread cannot be interrupted; its late result is rejected. */
	async invoke(request: RuntimeRequest): Promise<RuntimeResponse> {
		if (!portableJson(request)) return notPortable;
		const deadline = runtimeDeadline(this.timeoutMs);
		const result = Promise.resolve()
			.then(() => this.handler(request))
			.then(runtimeResponse, (error: unknown) =>
				runtimeFailure('runtime-failed', error instanceof Error ? error.message : String(error))
			);
		return deadline.settle(await Promise.race([result, deadline.expired]));
	}

	close(): Promise<void> {
		return Promise.resolve();
	}
}
