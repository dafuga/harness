import type { Workspace } from '../lib/stores/workspace.svelte';
import type { ProjectSnapshot } from '../models/Desktop.types';
import type { CacheStatus, ProjectCapabilities } from '../models/ProjectContext.types';
import { closedCapabilities } from './projectCapabilities';

/** The project id of an event about discovery or the whole session, not one project. */
export const everyProject = '$projects';
export const deniedNotice = 'Access to this shared project ended. Connect again or ask its owner.';
export const offlineNotice = 'Offline cached view. Comments and changes need a connection.';

export interface OfflineView {
	cachedAt: string | null;
}

/** Offline nothing can be changed, and nothing is promised about current membership. */
export function offlineCapabilities(source: ProjectCapabilities['source']): ProjectCapabilities {
	return { ...closedCapabilities, source, reason: offlineNotice };
}

/** What a snapshot says about being a cached copy; null for a current one. */
export function offlineView(snapshot: ProjectSnapshot): OfflineView | null {
	const cache = snapshot.cache;
	const cached = cache && (cache.status === 'offline' || cache.readOnly === true);
	return cached ? { cachedAt: cache.cachedAt ?? null } : null;
}

/** Only a project the bridge listed as local is local; anything else is treated as shared. */
function listedLocal(workspace: Workspace, projectId: string | null) {
	return workspace.projects.some((item) => item.id === projectId && item.kind === 'local');
}

/**
 * Removes what a person may no longer see: the shown shared project when the event names it or
 * the whole session, and a navigation towards it. A local project stays as it is.
 */
export function forgetShared(workspace: Workspace, projectId: string, notice: string): void {
	const all = projectId === everyProject;
	const named = (id: string | null) => id !== null && (all || id === projectId);
	if (all) workspace.projects = workspace.projects.filter((item) => item.kind === 'local');
	if (named(workspace.target) && !listedLocal(workspace, workspace.target)) workspace.invalidate();
	if (!named(workspace.projectId) || workspace.capabilities.source !== 'github') return;
	workspace.invalidate();
	workspace.snapshot = null;
	workspace.entity = null;
	workspace.offline = null;
	workspace.capabilities = closedCapabilities;
	workspace.error = notice;
	/** One project was refused: the list is read again, as the person may no longer be in it. */
	if (!all) void workspace.loadProjects();
}

/** The shown project becomes a read-only cached view, in place, before cached content arrives. */
function markOffline(workspace: Workspace, cachedAt: string | null) {
	const snapshot = workspace.snapshot;
	if (!snapshot) return;
	if (!workspace.offline)
		workspace.capabilities = offlineCapabilities(workspace.capabilities.source);
	workspace.offline = { cachedAt };
	snapshot.writable = false;
	if (snapshot.cache)
		Object.assign(snapshot.cache, {
			status: 'offline',
			readOnly: true,
			cachedAt: cachedAt ?? undefined
		});
}

/**
 * Applies an event the bridge sends before it answers the read the event belongs to. `fresh`
 * changes nothing here: only a snapshot that is read anew makes a view current again.
 */
export function cacheStatus(workspace: Workspace, event: CacheStatus): void {
	if (event.status === 'denied') forgetShared(workspace, event.projectId, deniedNotice);
	if (event.status === 'offline' && event.projectId === workspace.projectId)
		markOffline(workspace, event.cachedAt ?? null);
}
