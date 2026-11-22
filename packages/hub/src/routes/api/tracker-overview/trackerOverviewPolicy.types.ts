// @harness-uid u_k4rxbz6pq3
import type { RequestSessionService } from '../../../lib/verification-evidence/server/auth/request-session-service/RequestSessionService';
import type { OverviewBucket } from './trackerOverviewCache.types';

/** Everything the endpoint reads from its environment, passed in so tests can supply it. */
export type OverviewDeps = {
	ownerId: string | undefined;
	sessions: Pick<RequestSessionService, 'resolve'> | null;
	bucket: OverviewBucket | undefined;
	now: number;
};
