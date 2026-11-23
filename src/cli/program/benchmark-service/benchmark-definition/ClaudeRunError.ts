// @harness-uid u_zynlj7sdh7
/** A Claude benchmark run that failed, or reported a model other than its candidate's. */
export class ClaudeRunError extends Error {
	override name = 'ClaudeRunError';
}
