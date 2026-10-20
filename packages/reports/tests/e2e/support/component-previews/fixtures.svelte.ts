import { explorerCases } from './explorer';
import { legacyCases } from './legacy';
import { reportCases } from './reports';
import { activityCases, activity } from './activity';
import { analyticsCases } from './analytics';
import { createDesktopData } from './desktopData.svelte';
import { desktopControls } from './desktopControls';
import { desktopRuntime } from './desktopRuntime';
import { remotePreview } from './remote.svelte';
import { hubPreview } from './hub.svelte';
import type { PreviewCases } from './shared';
export function previewFixture(id: string) {
	const desktop = createDesktopData(id);
	const remote = remotePreview();
	const hub = hubPreview(id);
	const desktopCases = Object.fromEntries(
		Object.entries({ ...desktopControls, ...desktopRuntime }).map(([id, props]) => [
			id,
			props(desktop)
		])
	);
	desktop.workspace.remote = { host: {} as never };
	const explorer = explorerCases;
	const legacy = {
		...legacyCases,
		'reports.component.harness-harness-activity': {
			...legacyCases['reports.component.harness-harness-activity'],
			client: { activity: async () => activity }
		}
	};
	const cases: PreviewCases = {
		...explorer,
		...legacy,
		...reportCases,
		...activityCases,
		...analyticsCases,
		...desktopCases,
		...remote.cases,
		...hub.cases,
		'desktop.component.remote-connection': { workspace: desktop.workspace }
	};
	if (!cases[id]) throw new Error(`No representative fixture for ${id}`);
	return {
		props: cases[id],
		remote,
		hub: hub.context,
		cleanup: desktop.cleanup,
		ready: desktop.ready
	};
}
