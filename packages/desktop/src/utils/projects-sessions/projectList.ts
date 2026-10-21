import type { DesktopBridge } from '../../models/development-tooling/DesktopBridge.types';
import type { DesktopProject } from '../../models/projects-sessions/ProjectContext.types';

/** The projects a bridge remembers or may read; a bridge without the operation has none. */
export async function listedProjects(bridge: DesktopBridge): Promise<DesktopProject[]> {
	return bridge.listProjects ? bridge.listProjects() : [];
}

export { projectList } from '../../components/projects-sessions/project-switcher/projectList';
