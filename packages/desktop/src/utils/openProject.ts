import type { Workspace } from '../lib/stores/workspace.svelte';
import { workspacePath } from './workspaceRoute';

/** Lets the person choose a folder of this device; the bridge then has that project selected. */
export async function openProject(workspace: Workspace): Promise<void> {
	if (!workspace.bridge) return;
	workspace.busy = true;
	workspace.error = '';
	try {
		const opened = await workspace.bridge.openProject();
		if (!opened) return;
		const projectId = opened.project.id ?? null;
		workspace.selection.id = projectId;
		const branch = opened.revision.branch;
		await workspace.navigate(workspacePath({ projectId, branch, category: 'pages' }));
		await workspace.loadProjects();
	} catch (cause) {
		workspace.error = String(cause);
	} finally {
		workspace.busy = false;
	}
}
