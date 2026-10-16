import type { Workspace } from '../lib/stores/workspace.svelte';
import { closedCapabilities } from './projectCapabilities';

/**
 * A phone that is no longer paired keeps nothing of the computer: no project, no view, no read
 * under way, and no address that names one of its projects.
 */
export function forgetRemote(workspace: Workspace, notice = ''): void {
	workspace.invalidate();
	workspace.projects = [];
	workspace.snapshot = null;
	workspace.entity = null;
	workspace.offline = null;
	workspace.capabilities = closedCapabilities;
	workspace.selection.id = null;
	workspace.target = null;
	workspace.error = notice;
	const path = globalThis.location?.pathname ?? '/';
	if (path !== '/') globalThis.history?.replaceState({}, '', '/');
}
