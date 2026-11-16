// @harness-uid u_qj36fxyfe3
/** A replay video cannot be provided: its report expired, or two preparation jobs are running. */
export class ReplayVideoUnavailableError extends Error {
	override name = 'ReplayVideoUnavailableError';
}
