import type { ProjectCapabilities } from '../../models/projects-sessions/ProjectContext.types';

/** What is assumed when nothing proves more: reading only. */
export const closedCapabilities: ProjectCapabilities = {
	comments: false,
	agents: false,
	planning: false,
	approval: false,
	source: 'local'
};

export { projectCapabilities } from './load-workspace/projectCapabilities';
