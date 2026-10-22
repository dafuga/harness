import { createWorkspaceStore } from '../../../../../desktop/src/lib/stores/workspace.svelte';
import { ConsoleBridgeAdapter } from './ConsoleBridgeAdapter';
/** The standalone explorer hosts the same project conversation, without rewriting its URLs. */
export function createConsoleWorkspaceStore(navigate: (path: string, replace: boolean) => void) {
	const workspace = createWorkspaceStore(),
		transport = new ConsoleBridgeAdapter();
	workspace.routeProject = false;
	workspace.onNavigate = (url, push) => navigate(url.replace(/^\/harness/, ''), !push);
	workspace.connect(transport.bridge(), { local: false });
	return { workspace, close: () => transport.close() };
}
