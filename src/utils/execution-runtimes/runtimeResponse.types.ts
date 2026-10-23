import type { RuntimeResponse } from '../../core/execution-runtimes/runtimeTypes';

export interface RuntimeDeadline {
	/** Resolves with a timeout failure once the deadline passes, if a timer can fire. */
	expired: Promise<RuntimeResponse>;
	/** Returns the response, or a timeout failure when it arrived after the deadline. */
	settle(response: RuntimeResponse): RuntimeResponse;
}
