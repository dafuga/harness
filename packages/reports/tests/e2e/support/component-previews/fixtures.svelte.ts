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
import type { PreviewCases } from './shared';
export function previewFixture(id: string) {
	const desktop = createDesktopData(id);
	// The shell opens at Pages, where its store starts and where the web workspace opens too.
	if (id === 'desktop.component.workspace-shell') desktop.workspace.category = 'pages';
	const remote = remotePreview();
	const hub = hubPreview(id, desktop.workspace.snapshot!);
	const desktopCases = Object.fromEntries(
		Object.entries({ ...desktopControls, ...desktopRuntime, ...deploymentCases }).map(
			([id, props]) => [id, props(desktop)]
		)
	);
	desktop.workspace.remote = { host: {} as never };
	const explorer = explorerCases;
	const legacy = {
		...legacyCases,
		'reports.component.harness-harness-activity': {
			...legacyCases['reports.component.harness-harness-activity'],
			// What a built history recorded: the same synthetic activity, read as recorded.
			client: { activity: async () => ({ ...activity, kind: 'recorded' }) }
		}
	};
	const cases: PreviewCases = {
		...explorer,
		...legacy,
		...reportCases,
		...activityCases,
		...analyticsCases,
		...desktopCases,
		...gameCases,
		...remote.cases,
		...hub.cases,
		'desktop.component.remote-connection': { workspace: desktop.workspace }
	};
	if (!cases[id]) throw new Error(`No representative fixture for ${id}`);
	// A shell that reads its place from the browser is opened where its host serves it.
	const address = { ...legacyAddresses, ...hub.addresses }[id];
	if (address) history.replaceState(history.state, '', address);
	return {
		props: cases[id],
		remote,
		hub: hub.context,
		cleanup: desktop.cleanup,
		ready: desktop.ready
	};
}
