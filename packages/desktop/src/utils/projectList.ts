import type { DesktopBridge } from '../models/DesktopBridge.types';
import type { DesktopProject } from '../models/ProjectContext.types';

/** The projects a bridge remembers or may read; a bridge without the operation has none. */
export async function listedProjects(bridge: DesktopBridge): Promise<DesktopProject[]> {
	return bridge.listProjects ? bridge.listProjects() : [];
}

export { projectList } from '../components/project-switcher/projectList';
