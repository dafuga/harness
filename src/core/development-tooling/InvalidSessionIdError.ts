// @harness-uid u_riakl65jnq
/** An explicit Codex session ID that does not match the session-ID pattern. */
export class InvalidSessionIdError extends Error {
	override name = 'InvalidSessionIdError';
}
