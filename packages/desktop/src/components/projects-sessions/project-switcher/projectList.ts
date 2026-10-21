import type { ProjectSnapshot } from '../../../models/development-tooling/Desktop.types';
import type { DesktopProject } from '../../../models/projects-sessions/ProjectContext.types';

/** The switcher always holds the shown project, also when the bridge does not list it. */
export function projectList(
	projects: DesktopProject[],
	snapshot: ProjectSnapshot | null
): DesktopProject[] {
	if (!snapshot) return projects;
	const id = snapshot.project.id ?? '';
	if (projects.some((project) => project.id === id)) return projects;
	const kind = snapshot.capabilities?.source === 'github' ? 'shared' : 'local';
	return [...projects, { id, name: snapshot.project.name, kind }];
}
