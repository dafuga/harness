// @harness-uid u_5nixbr5ktz
/** A Codex RPC request that Codex answered with an error, or that timed out without an answer. */
export class CodexRpcError extends Error {
	override name = 'CodexRpcError';
}
