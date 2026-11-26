// @harness-uid u_eymqu7nm4p
/** A Codex turn that ran on another model or provider, failed on the server, did not complete, or timed out. */
export class CodexTurnError extends Error {
	override name = 'CodexTurnError';
}
