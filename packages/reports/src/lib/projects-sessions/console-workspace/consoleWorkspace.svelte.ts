import { explorerRoute, explorerRoutePath } from '../../../../../../src/utils/explorerRoute';
import { createWorkspaceStore } from '../../../../../desktop/src/lib/stores/workspace.svelte';
import { ConsoleBridgeAdapter } from './ConsoleBridgeAdapter';
/** The standalone explorer hosts the same project conversation, without rewriting its URLs. */
export function createConsoleWorkspaceStore(navigate: (path: string, replace: boolean) => void) {
	const workspace = createWorkspaceStore(),
		transport = new ConsoleBridgeAdapter();
	workspace.routeProject = false;
	const navigateWorkspace = workspace.navigate.bind(workspace);
	workspace.navigate = (path, push = true) => navigateWorkspace(projectChatPath(path), push);
	workspace.onNavigate = (url, push) => navigate(url.replace(/^\/harness/, ''), !push);
	workspace.connect(transport.bridge(), { local: false });
	return { workspace, close: () => transport.close() };
}

/** Global module screens discuss the project, while keeping source-unit selection explicit. */
function projectChatPath(path: string): string {
	const route = explorerRoute(path.replace(/^\/harness/, ''));
	if (!route || !['modules', 'module-resources'].includes(route.screen ?? '')) return path;
	return (
		'/harness' +
		explorerRoutePath({ branch: route.branch, commit: route.commit, category: 'pages' })
	);
}
