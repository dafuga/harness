import { modulePreview } from './modules';
import { previewVariants } from './catalogVariants';
import { baselineNarration, releaseNarration } from './reportData';
import { noop } from './shared';
import type { ExplorerScreenProps } from '../../../../src/models/explorer-ui/ExplorerScreen.types';
import { explorerCases } from './explorer';
import { legacyAddresses, legacyCases } from './legacy';
import { reportCases } from './reports';
import { activityCases, activity, activityVariant } from './activity';
import { analyticsCases, analyticsVariant } from './analytics';
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
import { projectAgentStateFixture } from './projectAgentStateFixtures';
import type { ProjectAgentState } from './projectAgentStateFixtures.types';
export function previewFixture(id: string, variant = '') {
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
	const selectedProps = projectAgentProps(id, props, desktop, variant);
	const rendered = variantProps(id, selectedProps, variant);
	// A shell that reads its place from the browser is opened where its host serves it.
	const address = { ...legacyAddresses, ...hub.addresses }[id];
	if (address) history.replaceState(history.state, '', address);
	return {
		props: rendered,
		remote,
		hub: hub.context,
		cleanup: () => {
			desktop.cleanup();
			route?.restore();
		},
		ready: desktop.ready
	};
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
	if (!variant || id === 'desktop.component.project-agent') return props;
	const report = reportVariantProps(id, props, variant);
	if (report) return report;
	if (id === 'reports.component.entity-search') return props;
	if (id === 'reports.component.status-badge') return { ...props, status: variant };
	const activityProps = activityVariant(id, variant, props);
	if (activityProps !== props) return activityProps;
	const analyticsProps = analyticsVariant(id, variant, props);
	if (analyticsProps !== props) return analyticsProps;
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

function reportVariantProps(id: string, props: PreviewCases[string], variant: string) {
	if (id === 'reports.component.filter-dialog') return filterDialogVariant(props, variant);
	if (id === 'reports.component.audio-evidence') return audioEvidenceVariant(props, variant);
	if (id === 'reports.component.audio-upload-files') return audioUploadFilesVariant(props, variant);
	if (id === 'reports.component.evidence-card') return evidenceCardVariant(props, variant);
	if (id === 'reports.component.evidence-grid') return evidenceGridVariant(props, variant);
	if (
		id !== 'reports.component.audio-comparison' &&
		id !== 'reports.component.audio-comparison-viewer'
	)
		return null;
	if (variant === 'before' || variant === 'after') return props;
	if (variant !== 'unavailable') return null;
	const before = props.before as Record<string, unknown>;
	return {
		...props,
		before: {
			...before,
			file: '',
			missing: true,
			note: 'The original recording was not retained with this evidence.'
		}
	};
}

function filterDialogVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'active') return { ...props, active: 3 };
	return props;
}

function audioUploadFilesVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'comparison') return { ...props, mode: 'comparison' };
	if (variant === 'uploading') return { ...props, mode: 'comparison', uploading: true };
	return null;
}

function evidenceCardVariant(props: PreviewCases[string], variant: string) {
	const item = props.item as Record<string, unknown>;
	if (variant === 'missing')
		return {
			...props,
			item: { ...item, missing: true, note: 'The recorded screenshot could not be restored.' }
		};
	if (variant === 'compact')
		return {
			...props,
			compact: true,
			item: {
				...item,
				provenance: [
					{ label: 'Viewport', value: 'Desktop' },
					{ label: 'Source', value: 'Browser capture' }
				]
			}
		};
	if (variant === 'paired-audio')
		return { ...props, item: releaseNarration, before: baselineNarration };
	return null;
}

function evidenceGridVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'uploads')
		return { ...props, reportId: 'preview-report', onUploaded: noop, idPrefix: 'upload-' };
	return props;
}

function audioEvidenceVariant(props: PreviewCases[string], variant: string) {
	const item = props.item as Record<string, unknown>;
	if (variant === 'notes')
		return {
			...props,
			item: {
				...item,
				transcript: undefined,
				note: 'Timing and diction were reviewed before approval.'
			}
		};
	if (variant !== 'unavailable') return null;
	return {
		...props,
		item: {
			...item,
			file: '',
			missing: true,
			note: 'The original recording was not retained with this evidence.'
		}
	};
}
