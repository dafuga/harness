// @harness-uid u_idcdl5fjlo
/** Existing build services could not be observed: the baseline was missing, or a service was not attested or anchored. */
export class ServiceObservationError extends Error {
	override name = 'ServiceObservationError';
}
