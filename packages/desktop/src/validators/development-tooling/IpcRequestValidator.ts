import { ProjectContextValidator } from '../projects-sessions/ProjectContextValidator';
import { channels } from '../../models/development-tooling/DesktopBridge.types';
import { ipcPayload } from '../../utils/development-tooling/ipc-payload/ipcPayload';
import { gamePayload } from './gamePayload';
export class IpcRequestValidator {
	parse(channel: string, input: unknown): unknown {
		if (!(Object.values(channels) as string[]).includes(channel))
			throw new Error('Unknown desktop operation.');
		if (channel === channels.projectWork) return projectWorkPayload(input);
		if (channel === channels.selectFeaturePlan || channel === channels.approveFeaturePlan)
			return { ...(ipcPayload(channel, input) as object), ...projectWorkPayload(input) };
		if (channel.startsWith('game:')) return gamePayload(channel, input);
		const context = new ProjectContextValidator();
		const extended = context.operation(channel, input);
		if (extended !== undefined) return extended;
		const parsed = ipcPayload(channel, input);
		return parsed && typeof parsed === 'object' ? { ...parsed, ...context.context(input) } : parsed;
	}
}

function projectWorkPayload(input: unknown): { projectId: string } {
	if (!input || typeof input !== 'object' || Array.isArray(input))
		throw new Error('Project work requires an object with a projectId.');
	const projectId = (input as { projectId?: unknown }).projectId;
	if (typeof projectId !== 'string' || !projectId.trim())
		throw new Error('Project work requires a nonempty projectId.');
	return { projectId };
}
