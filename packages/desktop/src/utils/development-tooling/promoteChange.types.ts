import type { RunContext } from '../../models/RunContext.types';
import type { RunRequest } from '../../models/DesktopBridge.types';

/** Runs inside the change run's existing repository lock; no remote branches are pushed. */
export type PromotionContext = Pick<
	RunContext,
	'root' | 'emit' | 'id' | 'signal' | 'session' | 'revision'
> & { request: Pick<RunRequest, 'environment'> };
