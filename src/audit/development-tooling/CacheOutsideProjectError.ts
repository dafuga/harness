// @harness-uid u_a3ytqsxx4a
/** A cache directory or nearest existing ancestor that resolves outside the project root. */
export class CacheOutsideProjectError extends Error {
	override name = 'CacheOutsideProjectError';
}
