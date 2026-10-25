import { explorerCases } from './explorer';
import { legacyAddresses, legacyCases } from './legacy';
import { reportCases } from './reports';
import { activityCases, activity } from './activity';
import { analyticsCases } from './analytics';
import { createDesktopData } from './desktopData.svelte';
import { desktopControls } from './desktopControls';
import { desktopRuntime, gameCases } from './desktopRuntime';
import { deploymentCases } from './deployments';
import { remotePreview } from './remote.svelte';
import { hubPreview } from './hub.svelte';
import { routeFixture } from './routePages';
import { desktopRoute } from './routeDesktop.svelte';
import { hubRoute } from './routeHub';
import type { PreviewCases } from './shared';
import { nativeAtomFixture } from './nativeAtomProps';
export function previewFixture(id: string) {
	const desktop = createDesktopData(id);
	// The shell opens at Pages, where its store starts and where the web workspace opens too.
	if (id === 'desktop.component.workspace-shell') desktop.workspace.category = 'pages';
	const remote = remotePreview();
	const hub = hubPreview(id, desktop.workspace.snapshot!);

	desktop.workspace.remote = { host: {} as never };
	const legacy = {
		...legacyCases,
		'reports.component.harness-harness-activity': {
			...legacyCases['reports.component.harness-harness-activity'],
			// What a built history recorded: the same synthetic activity, read as recorded.
			client: { activity: async () => ({ ...activity, kind: 'recorded' }) }
		}
	};
	const cases: PreviewCases = {
		...explorerCases,
		...legacy,
		...reportCases,
		...activityCases,
		...analyticsCases,
		...desktopCases(desktop),
		...gameCases,
		...remote.cases,
		...hub.cases,
		'desktop.component.remote-connection': { workspace: desktop.workspace }
	};
	// A route module is opened at its own address; it renders what the history holds there.
	// A Desktop page reads the orders project over the synthetic bridge installed for it.
	const route = desktopRoute(id, desktop);
	const props =
		routeFixture(id) ??
		route?.props ??
		hubRoute(id, hub.addresses['hub.component.hosted-workspace'], hub.project.id) ??
		cases[id] ??
		nativeAtomFixture(id);
	if (!props) throw new Error(`No representative fixture for ${id}`);
	// A shell that reads its place from the browser is opened where its host serves it.
	const address = { ...legacyAddresses, ...hub.addresses }[id];
	if (address) history.replaceState(history.state, '', address);
	return {
		props,
		remote,
		hub: hub.context,
		cleanup: () => {
			desktop.cleanup();
			route?.restore();
		},
		ready: desktop.ready
	};
}

function desktopCases(desktop: ReturnType<typeof createDesktopData>) {
	return Object.fromEntries(
		Object.entries({ ...desktopControls, ...desktopRuntime, ...deploymentCases }).map(
			([id, props]) => [id, props(desktop)]
		)
	);
}
