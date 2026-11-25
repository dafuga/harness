// @harness-uid u_tfsynmwn64
/** A Claude run that did not run the requested model, or ended without a completed result. */
export class ClaudeRunFailedError extends Error {
	override name = 'ClaudeRunFailedError';
}
