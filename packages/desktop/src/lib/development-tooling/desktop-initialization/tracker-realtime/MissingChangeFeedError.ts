// @harness-uid u_vzeocdqpa3
/** The local tracker did not answer as a change feed, such as an older tracker without one. */
export class MissingChangeFeedError extends Error {
	override name = 'MissingChangeFeedError';
}
