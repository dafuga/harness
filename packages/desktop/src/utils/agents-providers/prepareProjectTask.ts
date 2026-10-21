import type { ProjectTaskRequest } from '../../models/development-tooling/DesktopBridge.types';
import type { ProjectRunContext } from './prepareProjectRun';

export interface ProjectTaskContext extends Omit<ProjectRunContext, 'request'> {
	request: ProjectTaskRequest;
}

export { prepareProjectTask } from '../../services/agents-providers/desktop-run-service/prepareProjectTask';
