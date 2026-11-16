// @harness-uid u_m3rqfrppy7
/**
 * Packaging for macOS was refused: this host is not macOS, or HARNESS_MAC_SIGN_IDENTITY is
 * malformed or names no available code-signing identity.
 */
export class MacPackageError extends Error {
	override name = 'MacPackageError';
}
