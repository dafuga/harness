// @harness-uid u_k4rxbz6pq3
import type { RequestSessionService } from '../../../lib/verification-evidence/server/auth/request-session-service/RequestSessionService';
import type { OverviewBucket } from './trackerOverviewCache.types';

export type OverviewSessions = Pick<RequestSessionService, 'resolve'> & {
	publisherLive: (idHash: string, ownerId: string) => Promise<boolean>;
};

/** Everything the endpoint reads from its environment, passed in so tests can supply it. */
export type OverviewDeps = {
	ownerId: string | undefined;
	sessions: OverviewSessions | null;
	bucket: OverviewBucket | undefined;
	now: number;
};
