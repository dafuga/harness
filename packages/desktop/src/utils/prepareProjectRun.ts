import type { ProjectRunRequest } from '../models/DesktopBridge.types';
import type { RunContext } from '../models/RunContext.types';
import type { ProjectSessionService } from '../services/ProjectSessionService';
import type { Preparation } from './prepareRun';

/** A creation run before anything exists: the project, the chosen runner and the request. */
export interface ProjectRunContext extends Omit<RunContext, 'request' | 'entity' | 'imageModel'> {
	request: ProjectRunRequest;
	preparation: Preparation;
	project: Awaited<ReturnType<ProjectSessionService['mutable']>>;
}

export { prepareProjectRun } from '../services/desktop-run-service/prepareProjectRun';
