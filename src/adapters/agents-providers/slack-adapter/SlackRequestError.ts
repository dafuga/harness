// @harness-uid u_rbaiidh57v
import type { PlatformFailureCode } from '../../../core/agents-providers/platformAdapter.types';

/** Bounded set of errors safe to send to the host or audit sink. */
export class SlackRequestError extends Error {
	constructor(
		readonly code: PlatformFailureCode,
		readonly retryAfterMs?: number
	) {
		super(code);
	}
}
