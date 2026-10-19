import type { ProjectTaskRequest } from '../models/DesktopBridge.types';
import type { ProjectRunContext } from './prepareProjectRun';

export interface ProjectTaskContext extends Omit<ProjectRunContext, 'request'> {
	request: ProjectTaskRequest;
}

export { prepareProjectTask } from '../services/desktop-run-service/prepareProjectTask';
