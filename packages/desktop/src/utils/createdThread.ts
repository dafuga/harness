import type { Workspace } from '../lib/stores/workspace.svelte';
import type { EntityDetail, ThreadInfo } from '../models/Desktop.types';

interface Aim {
	projectId?: string;
	entityId: string;
	threadId: string | null;
}
const pending = new WeakMap<Workspace, Aim>();

/** A one-time selection for the new entity, kept with this workspace rather than in its URL. */
export function rememberCreatedThread(workspace: Workspace, created: Omit<Aim, 'projectId'>) {
	if (created.threadId)
		pending.set(workspace, { ...created, projectId: workspace.context.projectId });
}

/** Consume only a thread belonging to the exact entity and project that completed the request. */
export function createdThread(workspace: Workspace, entity: EntityDetail): ThreadInfo | null {
	const aim = pending.get(workspace);
	pending.delete(workspace);
	if (!aim || aim.projectId !== workspace.context.projectId || aim.entityId !== entity.id)
		return null;
	return entity.threads.find((thread) => thread.id === aim.threadId) ?? null;
}
