// @harness-uid u_ypket7tnag
import type { RunContext } from '../../models/development-tooling/RunContext.types';
import type { RunRequest } from '../../models/DesktopBridge.types';

/** Runs inside the change run's existing repository lock; no remote branches are pushed. */
export type PromotionContext = Pick<
	RunContext,
	'root' | 'emit' | 'id' | 'signal' | 'session' | 'revision'
> & { request: Pick<RunRequest, 'environment'> };

/**
 * A change that could not be promoted: it was not on the configured source branch, its source
 * worktree was dirty, a required deployment target was missing, or it was cancelled before
 * deployment.
 */
export class PromotionError extends Error {
	override name = 'PromotionError';
}
