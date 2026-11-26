// @harness-uid u_kcmwm6nql2
/**
 * A Worker configuration whose routes cannot be shown safe: a lower environment overlaps or
 * inherits a production route, or a route mapping is ambiguous.
 */
export class CloudflareSafetyError extends Error {
	override name = 'CloudflareSafetyError';
}
