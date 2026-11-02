// @harness-uid u_fypq7d6v2c
import type { HubAgentPort } from './HubAgentController';
import type { CollaborationApi } from 'collaboration';
import type { Actor } from 'collaboration';
import type { HubProjectionService } from '../hub-projection-service/HubProjectionService';

export interface Context {
	executor?: HubAgentPort;
	api: CollaborationApi;
	projection: HubProjectionService;
	actor: Actor;
	request: Request;
	projectId: string;
}
