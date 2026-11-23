// @harness-uid u_gndb6l2t6f
/** A JSON resource path that is not repository-relative or that would leave the repository. */
export class ResourcePathError extends Error {
	override name = 'ResourcePathError';
}
