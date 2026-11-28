import { presentationCases } from './presentationVariants';
import { presentationVariant } from './presentationProps';
import { modulePreview } from './modules';
import { previewVariants } from './catalogVariants';
import { reportVariantProps } from './reportVariants';
import type { ExplorerScreenProps } from '../../../../src/models/explorer-ui/ExplorerScreen.types';
import { explorerCases } from './explorer';
import { specViewCases } from './specViewCases';
import { legacyAddresses, legacyCases } from './legacy';
import { reportCases } from './reports';
import { activityCases } from './activity';
import { createDesktopData } from './desktopData.svelte';
import { desktopControls } from './desktopControls';
import { desktopRuntime, gameCases } from './desktopRuntime';
import { deploymentCases, deploymentVariantProps } from './deployments';
import { coveragePanelVariantProps } from './coveragePanelVariants';
import { measuresPanelVariantProps } from './measuresPanelVariants';
import { remotePreview } from './remote.svelte';
import { hubPreview } from './hub.svelte';
import { routeFixture } from './routePages';
import { desktopRoute } from './routeDesktop.svelte';
import { hubRoute } from './routeHub';
import { noop, type PreviewCases } from './shared';
import { nativeAtomFixture } from './nativeAtomProps';
import { projectAgentStateFixture } from './projectAgentStateFixtures';
import type { ProjectAgentState } from './projectAgentStateFixtures.types';
import { evidenceViewerState } from './evidenceViewerState.svelte';
import { desktopPreviewVariant } from './desktopPreviewVariants';
import { desktopRuntimeReady } from './desktopRuntimeVariants';
import { shellArtworkProps } from './shellArtwork';
import ShellContentPreview from './ShellContentPreview.svelte';
const desktopChooserCases: PreviewCases = {
	'desktop.component.explorer-ui-entity-section-tabs': {
		names: ['Overview', 'States', 'History', 'Source'],
		tab: 'States',
		threadShown: false,
		onpick: noop,
		onconversation: noop
	},
	'desktop.component.shared-primitives-choice-row': {
		name: 'Main',
		meta: 'Current branch',
		current: true,
		onchoose: noop
	},
	'desktop.component.shared-primitives-choice-rows': { label: 'Branches', title: 'Branches' }
};
export function previewFixture(id: string, variant = '') {
	const desktop = createDesktopData(id);
	// The shell opens at Pages, where its store starts and where the web workspace opens too.
	if (id === 'desktop.component.workspace-shell') desktop.workspace.category = 'pages';
	const remote = remotePreview();
	const hub = hubPreview(id, desktop.workspace.snapshot!);

	desktop.workspace.remote = { host: {} as never };
	const legacy = {
		...legacyCases
	};
	const cases: PreviewCases = {
		...explorerCases,
		...specViewCases,
		...presentationCases,
		...legacy,
		...reportCases,
		...activityCases,
		...desktopCases(desktop),
		...gameCases,
		...remote.cases,
		...hub.cases,
		...desktopChooserCases,
		'reports.component.accounts-access-device-list-row': { name: 'Harbor Mac', status: 'Online' },
		'desktop.component.remote-connection': { workspace: desktop.workspace }
	};
	// A route module is opened at its own address; it renders what the history holds there.
	// A Desktop page reads the orders project over the synthetic bridge installed for it.
	const route = desktopRoute(id, desktop);
	const props = defaultProps(id, route?.props, hub, cases);
	if (!props) throw new Error(`No representative fixture for ${id}`);
	const selectedProps = projectAgentProps(id, props, desktop, variant);
	const rendered = variantProps(
		id,
		desktopPreviewVariant(id, selectedProps, desktop, variant),
		variant
	);
	// A shell that reads its place from the browser is opened where its host serves it.
	const address = { ...legacyAddresses, ...hub.addresses }[id];
	if (address) history.replaceState(history.state, '', address);
	return {
		props: reactiveProps(id, rendered, variant),
		remote,
		hub: hub.context,
		cleanup: () => {
			desktop.cleanup();
			route?.restore();
		},
		ready: desktopRuntimeReady(id, desktop, variant)
	};
}

function defaultProps(
	id: string,
	desktop: NonNullable<ReturnType<typeof desktopRoute>>['props'] | undefined,
	hub: ReturnType<typeof hubPreview>,
	cases: PreviewCases
) {
	return (
		(id === 'desktop.layout.root' ? {} : undefined) ??
		routeFixture(id) ??
		desktop ??
		hubRoute(id, hub.addresses['hub.component.hosted-workspace'], hub.project.id) ??
		cases[id] ??
		nativeAtomFixture(id)
	);
}

function reactiveProps(id: string, props: unknown, variant: string) {
	const input = props as PreviewCases[string];
	const artwork = shellArtworkProps(
		id,
		id === 'reports.component.harness-harness-console'
			? { ...input, content: ShellContentPreview }
			: input,
		variant
	);
	return id === 'reports.component.evidence-viewer' ? evidenceViewerState(artwork) : artwork;
}

function projectAgentProps(
	id: string,
	props: PreviewCases[string],
	desktop: ReturnType<typeof createDesktopData>,
	variant: string
) {
	if (id === 'desktop.component.project-agent')
		return projectAgentStateFixture(desktop, props, (variant || 'rest') as ProjectAgentState);
	return props;
}
function desktopCases(desktop: ReturnType<typeof createDesktopData>) {
	return Object.fromEntries(
		Object.entries({ ...desktopControls, ...desktopRuntime, ...deploymentCases }).map(
			([id, props]) => [id, props(desktop)]
		)
	);
}

function variantProps(id: string, props: PreviewCases[string], variant: string) {
	if (!previewVariants(id).includes(variant))
		throw new Error(`Unknown preview variant ${id}:${variant}`);
	if (!variant || nativeAtomFixture(id)) return props;
	const presentation = presentationVariant(id, props, variant);
	if (presentation) return presentation;
	if (id === 'desktop.component.deployment-details') return deploymentVariantProps(props, variant);
	if (id === 'desktop.component.coverage-panel') return coveragePanelVariantProps(props, variant);
	if (id === 'desktop.component.measures-panel') return measuresPanelVariantProps(props, variant);
	if (id.startsWith('desktop.component.')) return props;
	const report = reportVariantProps(id, props, variant);
	if (report) return report;
	return moduleVariant(id, props, variant);
}

function moduleVariant(id: string, props: PreviewCases[string], variant: string) {
	if (id === 'reports.component.entity-search') return props;
	if (id === 'reports.component.status-badge') return { ...props, status: variant };
	const shown = modulePreview(props as unknown as ExplorerScreenProps, variant);
	if (id.endsWith('explorer-module-resources-screen')) {
		const route = {
			...shown.route,
			screen: 'module-resources' as const,
			entity: variant + '.test'
		};
		return { ...shown, route, scope: { ...shown.scope, location: route } };
	}
	return shown;
}
