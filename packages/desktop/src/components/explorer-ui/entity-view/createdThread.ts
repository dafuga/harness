import { pending } from '../../../utils/explorer-ui/createdThread';
import type { Workspace } from '../../../lib/stores/projects-sessions/workspace.svelte';
import type { EntityDetail, ThreadInfo } from '../../../models/development-tooling/Desktop.types';

/** Consume only a thread belonging to the exact entity and project that completed the request. */
export function createdThread(workspace: Workspace, entity: EntityDetail): ThreadInfo | null {
	const aim = pending.get(workspace);
	pending.delete(workspace);
	if (!aim || aim.projectId !== workspace.context.projectId || aim.entityId !== entity.id)
		return null;
	return entity.threads.find((thread) => thread.id === aim.threadId) ?? null;
}
