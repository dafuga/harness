import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';

export interface Aim {
	projectId?: string;
	entityId: string;
	threadId: string | null;
}

export const pending = new WeakMap<Workspace, Aim>();

export { rememberCreatedThread } from './project-agent-events/rememberCreatedThread';
export { createdThread } from '../../components/explorer-ui/entity-view/createdThread';
