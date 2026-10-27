import { ProjectContextValidator } from '../projects-sessions/ProjectContextValidator';
import { channels } from '../../models/development-tooling/DesktopBridge.types';
import { creationProject, ipcPayload } from '../../utils/development-tooling/ipc-payload/ipcPayload';
import { commitPattern, ipcFields, textField } from '../../utils/development-tooling/ipcFields';
import { gamePayload } from './gamePayload';
import { planSchema } from '../../../../../src/repositories/agents-providers/module-task-repository/taskSchemas';
import type { FeaturePlanPreparationRequest } from '../../models/development-tooling/DesktopBridge.types';
export class IpcRequestValidator {
	parse(channel: string, input: unknown): unknown {
		if (!(Object.values(channels) as string[]).includes(channel))
			throw new Error('Unknown desktop operation.');
		if (channel === channels.prepareFeaturePlan) return featurePlanPayload(input);
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

function featurePlanPayload(input: unknown): FeaturePlanPreparationRequest {
	const fields = ipcFields(input),
		allowed = ['projectId', 'sourceCommit', 'originalRequest', 'proposal', 'pageDesigns'];
	if (Object.keys(fields).some((key) => !allowed.includes(key))) throw new Error('Invalid feature plan fields.');
	const sourceCommit = textField(fields.sourceCommit, 40, commitPattern),
		proposal = planSchema.omit({ pages: true, revision: true, digest: true, approval: true }).parse(fields.proposal);
	if (proposal.sourceCommit !== sourceCommit || !Array.isArray(fields.pageDesigns) || fields.pageDesigns.length > 10000)
		throw new Error('Invalid feature plan revision or page references.');
	return {
		projectId: creationProject(fields.projectId),
		sourceCommit,
		originalRequest: textField(fields.originalRequest, 20000),
		proposal,
		pageDesigns: fields.pageDesigns as FeaturePlanPreparationRequest['pageDesigns']
	};
}

function projectWorkPayload(input: unknown): { projectId: string } {
	if (!input || typeof input !== 'object' || Array.isArray(input))
		throw new Error('Project work requires an object with a projectId.');
	const projectId = (input as { projectId?: unknown }).projectId;
	if (typeof projectId !== 'string' || !projectId.trim())
		throw new Error('Project work requires a nonempty projectId.');
	return { projectId };
}
