// @harness-uid u_s6qkvyetfp
/** A Codex session operation failed: the session was cancelled or full, or a tool call was duplicate or not pending. */
export class CodexSessionError extends Error {
	override name = 'CodexSessionError';
}
