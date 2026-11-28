import type { RequestSessionService } from '../../../lib/verification-evidence/server/auth/request-session-service/RequestSessionService';
import type { ApprovalPush } from './syncApprovalPush.types';

/** What the sealed sync API needs from the Hub. A missing store disables it. */
export interface SyncDeps {
	sessions: Pick<RequestSessionService, 'resolve'> | null;
	db: D1Database | undefined;
	/** Large sealed envelopes. */
	bucket: R2Bucket | undefined;
	/** The account objects of the relay Worker, reached through this binding and no public route. */
	accounts: DurableObjectNamespace | null;
	approvalPush?: ApprovalPush;
	now: number;
}

/** One authenticated call: the account is the signed-in actor and never a field of the request. */
export interface SyncCall {
	request: Request;
	url: URL;
	account: string;
	sessionHash: string;
	sessionKind: 'browser' | 'native';
	/** The calling app's own device id (`X-Harness-Device`). The chain, not this id, decides trust. */
	device: string;
	deps: SyncDeps & { db: D1Database };
	/** The path after `/api/sync/v1/`, split. */
	parts: string[];
}
