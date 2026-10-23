import type { Aim } from './createdThread.types';
import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';

export const pending = new WeakMap<Workspace, Aim>();

export { rememberCreatedThread } from './project-agent-events/rememberCreatedThread';
export { createdThread } from '../../components/explorer-ui/entity-view/createdThread';

export type { Aim } from './createdThread.types';
