import type { ProjectCapabilities } from '../models/ProjectContext.types';
import { responseRecord } from '../validators/RemoteProjectResponseValidator';
export function hostedCapabilities(value: unknown, projectId: string): ProjectCapabilities {
	const project = responseRecord(value);
	if (
		project.id !== projectId ||
		!['owner', 'writer', 'commenter', 'viewer'].includes(String(project.role))
	)
		throw new Error('Unknown hosted project access.');
	const agents =
		['owner', 'writer'].includes(String(project.role)) && project.executionAvailable === true;
	return {
		comments: project.role !== 'viewer',
		agents,
		planning: agents,
		approval: agents,
		source: 'github',
		reason:
			project.role === 'viewer'
				? 'Read access: browse only.'
				: agents
					? 'Write access: comments and AI requests.'
					: ['owner', 'writer'].includes(String(project.role))
						? 'Write access. Connect a project executor to run AI.'
						: 'Comment access: read and leave comments.'
	};
}
