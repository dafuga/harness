// @harness-uid u_pfvgsqtjem
/** A Codex benchmark run that exited nonzero, or reported a model other than the candidate's. */
export class CodexRunError extends Error {
	override name = 'CodexRunError';
}
