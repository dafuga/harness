// @harness-uid u_lyv6pkc24d
/** A hosted artifact rejected for its size, its SHA-256, or a kind this app does not show. */
export class HostedArtifactRejectedError extends Error {
	override name = 'HostedArtifactRejectedError';
}
