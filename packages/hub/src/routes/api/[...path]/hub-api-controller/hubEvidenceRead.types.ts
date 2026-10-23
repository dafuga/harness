import type { Actor } from 'collaboration';
import type { HubProjectionService } from '../hub-projection-service/HubProjectionService';

export interface EvidenceRead {
	actor: Actor;
	projectId: string;
	request: Request;
	projection: HubProjectionService;
}
