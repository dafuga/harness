// @harness-uid u_gegtad6hae
/** A discovery with no hosted credential at its start, or whose credential changed while it ran. */
export class HostedAuthorityChangedError extends Error {
	override name = 'HostedAuthorityChangedError';
}
