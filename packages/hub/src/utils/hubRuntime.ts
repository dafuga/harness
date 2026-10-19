import type { HubAgentPort } from '../controllers/HubAgentController';
import type { CollaborationApi } from 'collaboration';
import type { HubProjectionService } from '../services/hub-projection-service/HubProjectionService';
import type { HubAuth } from '../lib/server/auth/auth';
import type { HubRemoteRuntime } from './hubRemote';

export interface HubApiRuntime {
	/** Explicit deployment injection only; absent until a project executor is connected. */
	agent?: HubAgentPort;
	auth: Pick<HubAuth, 'actor' | 'handle'>;
	connect(): { api: CollaborationApi; projection: HubProjectionService };
	/** Null or absent when the relay binding or its origin is not configured. */
	remote?: HubRemoteRuntime | null;
}

export { hubRuntime } from '../routes/api/[...path]/hubRuntime';
