import type { AgentRunner, ImageGenerator } from './AgentRunner.types';
import type { EntityDetail, Revision } from './Desktop.types';
import type { RunEvent, RunRequest } from './DesktopBridge.types';
import type { ProjectSessionService } from '../services/project-session-service/ProjectSessionService';
import type { PlanningPort } from './PlanningPort.types';
export interface RunContext {
	id: string;
	request: RunRequest;
	session: ProjectSessionService;
	root: string;
	revision: Revision;
	entity: EntityDetail;
	planning: PlanningPort;
	runner: AgentRunner;
	generator: ImageGenerator;
	imageModel: string;
	signal: AbortSignal;
	emit: (event: RunEvent) => void;
	failureRecorded?: boolean;
}
