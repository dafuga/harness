import type { ProjectCapabilities } from '../../models/projects-sessions/ProjectContext.types';
import { responseRecord } from '../../validators/projects-sessions/RemoteProjectResponseValidator';
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
		reason: hostedReason(project.role, agents)
	};
}
function hostedReason(role: unknown, agents: boolean): string {
	if (role === 'viewer') return 'Read access: browse only.';
	if (agents) return 'Write access: comments and AI requests.';
	if (['owner', 'writer'].includes(String(role)))
		return 'Write access. Connect a project executor to run AI.';
	return 'Comment access: read and leave comments.';
}
