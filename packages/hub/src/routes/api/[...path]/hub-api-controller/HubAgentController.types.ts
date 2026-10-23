import type { ProjectSummary } from 'collaboration';
import type { Actor } from 'collaboration';
import type { CollaborationApi } from 'collaboration';
import type { HubProjectionService } from '../hub-projection-service/HubProjectionService';

/** Bound executors own repository mapping and run ownership. Deduplicate requestId per actor/project and reject conflicting payloads. */
export interface HubAgentPort {
	available(project: ProjectSummary): Promise<boolean>;
	/** Cancel only this actor’s runs of this project when membership is revoked. */
	revoke(actorId: string, projectId: string): Promise<void>;
	execute(input: {
		project: ProjectSummary;
		actor: Actor;
		method: string;
		payload: unknown;
		/** Recheck immediately before queued work and while running; revoke must cancel that run. */
		authorize(): Promise<void>;
	}): Promise<unknown>;
}

export interface Context {
	api: CollaborationApi;
	projection: HubProjectionService;
	actor: Actor;
	request: Request;
	projectId: string;
	executor?: HubAgentPort;
}
