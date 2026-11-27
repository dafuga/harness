// @harness-uid u_ypket7tnag
/**
 * A change that could not be promoted: it was not on the configured source branch, its source
 * worktree was dirty, a required deployment target was missing, or it was cancelled before
 * deployment.
 */
export class PromotionError extends Error {
	override name = 'PromotionError';
}
