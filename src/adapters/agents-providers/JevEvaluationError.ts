// @harness-uid u_wbj45qwkyz
/** A Jev evaluation that was cancelled, timed out, rejected by the API, or failed validation. */
export class JevEvaluationError extends Error {
	override name = 'JevEvaluationError';
}
