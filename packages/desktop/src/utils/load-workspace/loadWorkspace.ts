import { offlineCapabilities, type OfflineView } from "../cache-status/cacheStatus";
import { offlineView } from "./cacheStatus";
import { projectCapabilities } from "./projectCapabilities";
import type { WorkspaceRoute } from "../workspaceRoute";
import type { DesktopBridge } from "../../models/DesktopBridge.types.ts";
import type { EntityDetail, ProjectSnapshot } from "../../models/Desktop.types.ts";
import type { ProjectCapabilities } from "../../models/ProjectContext.types.ts";

export interface LoadedWorkspace {
	snapshot: ProjectSnapshot;
	entity: EntityDetail | null;
	capabilities: ProjectCapabilities;
	offline: OfflineView | null;
}

/** The project the bridge was last told to select; null while that is not known. */
export interface ProjectSelection {
	id: string | null;
}

/** A bridge keeps one selected project, so another one is selected before anything is read. */
async function selected(bridge: DesktopBridge, route: WorkspaceRoute, selection: ProjectSelection) {
	if (!route.projectId || route.projectId === selection.id || !bridge.selectProject) return null;
	selection.id = null;
	const snapshot = await bridge.selectProject({ projectId: route.projectId });
	selection.id = route.projectId;
	return snapshot;
}

function shows(snapshot: ProjectSnapshot, route: WorkspaceRoute) {
	return (
		route.commit === null && (route.branch === null || route.branch === snapshot.revision.branch)
	);
}

/** The answer has to be of the project that was asked for; it is then the selected one. */
function owner(snapshot: ProjectSnapshot, route: WorkspaceRoute, selection: ProjectSelection) {
	const id = snapshot.project.id;
	if (route.projectId && id && id !== route.projectId)
		throw new Error('The bridge answered for another project.');
	if (id) selection.id = id;
	return id ? { projectId: id } : {};
}

/** Everything one address shows, read for exactly the project it names. */
export async function loadWorkspace(
	bridge: DesktopBridge,
	route: WorkspaceRoute,
	selection: ProjectSelection
): Promise<LoadedWorkspace> {
	const scope = route.projectId ? { projectId: route.projectId } : {};
	const opened = await selected(bridge, route, selection);
	const snapshot =
		opened && shows(opened, route)
			? opened
			: await bridge.snapshot({ branch: route.branch, commit: route.commit, ...scope });
	const context = owner(snapshot, route, selection);
	const entity = route.entityId
		? await bridge.entity({
				entityId: route.entityId,
				commit: snapshot.revision.commit,
				...context
			})
		: null;
	const capabilities = await projectCapabilities(bridge, snapshot);
	const offline = offlineView(snapshot);
	if (!offline) return { snapshot, entity, capabilities, offline };
	/** A cached copy allows no change, whatever its stored capabilities say. */
	const cached = { ...snapshot, writable: false };
	return {
		snapshot: cached,
		entity,
		capabilities: offlineCapabilities(capabilities.source),
		offline
	};
}
