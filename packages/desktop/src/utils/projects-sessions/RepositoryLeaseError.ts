// @harness-uid u_dluvqzqdcs
/** A project lock that cannot be taken, has a malformed saved owner, or is lost while held. */
export class RepositoryLeaseError extends Error {
	override name = 'RepositoryLeaseError';
}
