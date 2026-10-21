import type { ProjectRunRequest } from '../../models/development-tooling/DesktopBridge.types';
import type { RunContext } from '../../models/development-tooling/RunContext.types';
import type { ProjectSessionService } from '../../services/projects-sessions/project-session-service/ProjectSessionService';
import type { Preparation } from './prepareRun';

/** A creation run before anything exists: the project, the chosen runner and the request. */
export interface ProjectRunContext extends Omit<RunContext, 'request' | 'entity' | 'imageModel'> {
	request: ProjectRunRequest;
	preparation: Preparation;
	project: Awaited<ReturnType<ProjectSessionService['mutable']>>;
}

export { prepareProjectRun } from '../../services/agents-providers/desktop-run-service/prepareProjectRun';
