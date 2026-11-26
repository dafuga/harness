// @harness-uid u_si33ircueg
/** A hosted artifact refused for its kind, its content under that kind, or its SHA-256 digest. */
export class HostedArtifactRefusedError extends Error {
	override name = 'HostedArtifactRefusedError';
}
