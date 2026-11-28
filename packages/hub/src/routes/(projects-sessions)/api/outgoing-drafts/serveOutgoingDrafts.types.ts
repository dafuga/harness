import type { RequestSessionService } from '../../../../lib/verification-evidence/server/auth/request-session-service/RequestSessionService';
import type { outgoingGateway } from './outgoingGateway';

export interface OutgoingDraftDeps {
	ownerId?: string;
	sessions: Pick<RequestSessionService, 'resolve'> | null;
	gateway: ReturnType<typeof outgoingGateway>;
	fetcher: typeof fetch;
	now: number;
}
