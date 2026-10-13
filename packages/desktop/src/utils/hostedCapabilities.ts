import type { ProjectCapabilities } from '../models/ProjectContext.types';
import { responseRecord } from '../validators/RemoteProjectResponseValidator';
export function hostedCapabilities(value: unknown, projectId: string): ProjectCapabilities {
	const project = responseRecord(value);
	if (project.id !== projectId || !['owner', 'commenter', 'viewer'].includes(String(project.role)))
		throw new Error('Unknown hosted project access.');
	return {
		comments: project.role !== 'viewer',
		agents: false,
		planning: false,
		approval: false,
		source: 'github',
		reason: 'Shared comments require server acknowledgment; agents run only in local projects.'
	};
}
