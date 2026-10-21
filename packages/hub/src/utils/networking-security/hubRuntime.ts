import type { HubAgentPort } from '../../routes/api/[...path]/hub-api-controller/HubAgentController';
import type { CollaborationApi } from 'collaboration';
import type { HubProjectionService } from '../../routes/api/[...path]/hub-projection-service/HubProjectionService';
import type { HubAuth } from '../../lib/verification-evidence/server/auth/auth';
import type { HubRemoteRuntime } from './hubRemote';

export interface HubApiRuntime {
	/** Explicit deployment injection only; absent until a project executor is connected. */
	agent?: HubAgentPort;
	auth: Pick<HubAuth, 'actor' | 'handle'>;
	connect(): { api: CollaborationApi; projection: HubProjectionService };
	/** Null or absent when the relay binding or its origin is not configured. */
	remote?: HubRemoteRuntime | null;
}

export { hubRuntime } from '../../routes/api/[...path]/hubRuntime';
