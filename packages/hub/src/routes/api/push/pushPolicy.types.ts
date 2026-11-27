import type { RequestSessionService } from '../../../lib/verification-evidence/server/auth/request-session-service/RequestSessionService';

export interface PushDeps {
	ownerId?: string;
	publicKey?: string;
	origin?: string;
	sessions: Pick<RequestSessionService, 'resolve'> | null;
	db?: D1Database;
	now: number;
}

export type ReadyPushDeps = PushDeps & {
	ownerId: string;
	publicKey: string;
	origin: string;
	db: D1Database;
};
