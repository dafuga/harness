import type { DeploymentEnvironment } from '../Deployment.types';
import type { ProjectRunRequest } from '../development-tooling/DesktopBridge.types';
/** A project conversation tied to the exact revision the person is viewing. */
export interface ProjectTaskRequest extends Omit<ProjectRunRequest, 'intent' | 'mode'> {
	intent: 'task';
	mode: 'ask' | 'change';
	environment?: DeploymentEnvironment;
	branch: string;
	commit: string;
	/** Bounded public conversation; treated as user content, never as authority. */
	conversation?: Array<{ author: 'user' | 'agent'; text: string }>;
}
