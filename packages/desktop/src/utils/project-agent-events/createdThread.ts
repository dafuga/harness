import type { Aim } from '../createdThread';
import { pending } from '../createdThread';
import type { Workspace } from '../../lib/stores/workspace.svelte';

/** A one-time selection for the new entity, kept with this workspace rather than in its URL. */
export function rememberCreatedThread(workspace: Workspace, created: Omit<Aim, 'projectId'>) {
	if (created.threadId)
		pending.set(workspace, { ...created, projectId: workspace.context.projectId });
}
