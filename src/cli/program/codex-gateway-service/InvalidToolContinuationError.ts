// @harness-uid u_s6zl3tydae
/**
 * A tool continuation that validate refuses: no active query owns it, its outputs repeat a call,
 * or they do not cover every pending call.
 */
export class InvalidToolContinuationError extends Error {
	override name = 'InvalidToolContinuationError';
}
