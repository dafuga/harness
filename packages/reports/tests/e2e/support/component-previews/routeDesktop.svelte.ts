import { exampleDocument } from '../../../../../game/src/index';
import type { DesktopBridge } from '../../../../../desktop/src/models/DesktopBridge.types';
import type { ProjectSnapshot } from '../../../../../desktop/src/models/Desktop.types';
import type { EnvironmentHost } from '../../../../../desktop/src/models/Environment.types';
import type { DesktopData } from './desktopData.svelte';
import { desktopData } from './sealedData';
import { openRoute, page } from './router.svelte';
import type { PreviewProps } from './shared';
const project = encodeURIComponent(desktopData.project.id);
/** The tip of the orders branch at Pages, where the workspace opens; then under its project. */
const tip = `/harness/branch/${encodeURIComponent(desktopData.branch)}/pages`;
const workspace = `/projects/${project}${tip}`;
/** The SvelteKit route a Desktop page module is served under, and the address it is opened at. */
export const desktopRoutes: Record<string, { route: string; path: string }> = {
	// No project is chosen yet: the gate lists the one the bridge remembers.
	'desktop.page.root': { route: '/', path: '/' },
	// An address that names no project; once read, the workspace names the project it shows.
	'desktop.page.harness-path': { route: '/harness/[...path]', path: tip },
	'desktop.page.projects-project-id-harness-path': {
		route: '/projects/[projectId]/harness/[...path]',
		path: workspace
	},
	// Opened from the workspace, as its settings link opens it, so its back link returns there.
	'desktop.page.settings': {
		route: '/settings',
		path: `/settings?from=${encodeURIComponent(workspace)}`
	},
	// The built-in demonstration is a real game state, without pretending Orders is a game project.
	'desktop.page.game': { route: '/game', path: '/game' }
};
/**
 * SYNTHETIC `window.harness`, where the Electron preload exposes it: the typed preview bridge over
 * the sealed orders history, answering for its one project at its branch tip. Nothing behind it
 * reads a file, a folder, a model or a device; what would create or save anything is refused.
 */
function routeBridge(desktop: DesktopData): DesktopBridge {
	const shown: ProjectSnapshot = {
		...desktop.workspace.snapshot!,
		capabilities: desktop.workspace.capabilities
	};
	const { id = '', name, root } = shown.project;
	// Like the main process: an operation for another project is refused, as is another commit.
	const own = (input: { projectId?: string; commit?: string | null }) => {
		if (input.projectId !== undefined && input.projectId !== id)
			throw new Error('The requested project is not selected.');
		if (input.commit && input.commit !== shown.revision.tip)
			throw new Error('The preview bridge holds the branch tip only.');
		return shown;
	};
	return {
		...desktop.bridge,
		listProjects: async () => [{ id, name, kind: 'local', root }],
		selectProject: async (input) => own(input),
		snapshot: async (input) => own(input),
		// The folder chooser is closed without choosing one.
		openProject: async () => null,
		gameCreate: async () => {
			throw new Error('Preview fixtures cannot create projects.');
		},
		// The example game of the game package, read as this project's game views.
		gameRead: async (input) => {
			own(input);
			return { document: exampleDocument('2d'), revision: 'a'.repeat(64) };
		},
		gameSave: async () => {
			throw new Error('Preview fixtures cannot save games.');
		}
	};
}
/**
 * Opens a Desktop page module at its address. Its bridge is installed before it mounts, as the
 * preload installs it, and `restore` gives the document back what it held before.
 */
export function desktopRoute(id: string, desktop: DesktopData) {
	const preview = desktopRoutes[id];
	if (!preview) return undefined;
	openRoute(preview.route, preview.path);
	const host = window as Window & EnvironmentHost;
	const held = { had: 'harness' in host, bridge: host.harness };
	const environment = document.documentElement.dataset.environment;
	host.harness = routeBridge(desktop);
	// None of these routes loads data or posts a form: SvelteKit gives them their params alone.
	const props: PreviewProps = { data: {}, form: null, params: { ...page.params } };
	return {
		props,
		restore: () => {
			if (held.had) host.harness = held.bridge;
			else delete host.harness;
			// The workspace says which runtime it found on the document; that is taken back too.
			if (environment === undefined) delete document.documentElement.dataset.environment;
			else document.documentElement.dataset.environment = environment;
		}
	};
}
