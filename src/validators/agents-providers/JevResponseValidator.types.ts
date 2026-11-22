// @harness-uid u_hqf5srvofj
/** A Jev response whose model, answers, choices or probabilities do not fit its questions. */
export class InvalidJevResponseError extends Error {
	override name = 'InvalidJevResponseError';
}
