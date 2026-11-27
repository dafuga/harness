<script lang="ts">
	import { setContext, onDestroy, untrack } from 'svelte';
	import { Controls, SvelteFlow, type Edge, type Node } from '@xyflow/svelte';
	import { key } from '../../../../../hub/src/utils/browserContext';
	import {
		nativeAccountContext,
		remoteContext
	} from '../../../../../desktop/src/models/development-tooling/Environment.types';
	import type {
		EnvironmentHost,
		NativeAccountContext
	} from '../../../../../desktop/src/models/development-tooling/Environment.types';
	import { exampleDocument } from '../../../../../game/src/index';
	import ChoiceRow from '../../../../../desktop/src/components/shared-primitives/ChoiceRow.svelte';
	import { previewUnits, previewComponent } from './units';
	import { previewFixture } from './fixtures.svelte';
	import { previewTracker } from './remote.svelte';
	import { routePreview } from './visualUnits';
	import PresentationPreviews from './PresentationPreviews.svelte';
	import ExplorerIndexPreview from './ExplorerIndexPreview.svelte';
	import ExplorerFramePreview from './ExplorerFramePreview.svelte';
	import NativeAtomPreview from './NativeAtomPreview.svelte';
	import HubHomeCatalogPreview from './HubHomeCatalogPreview.svelte';
	import { isHubHomePreview } from './hubHomeCatalogData';
	import { noop } from './shared';
	let { id: requested }: { id: string } = $props();
	const id = untrack(() => requested);
	const unit = previewUnits.find((unit) => unit.id === id);
	if (!unit) throw new Error(`Unknown preview component ${id}`);
	const variant = new URLSearchParams(location.search).get('variant') ?? '';
	const fixture = previewFixture(id, variant);
	const reportView = id === 'reports.component.report-view';
	const compactEvidence =
		id === 'reports.component.evidence-card' && ['compact', 'compact-closed'].includes(variant);
	const galleryCard = [
		'reports.component.evidence-card',
		'reports.component.audio-comparison'
	].includes(id);
	const Component = previewComponent(unit.source);
	const presentationIds = Object.fromEntries(
		['data-table', 'code-line', 'detail-list'].map((name) => [
			`reports.component.shared-primitives-${name}`,
			true
		])
	);
	const layout = unit.kind === 'layout';
	const Root = layout ? previewComponent('packages/reports/src/routes/+layout.svelte') : null;
	const fullFrame =
		(id === 'reports.component.harness-harness-selectors' && ['tip', 'at-tip'].includes(variant)) ||
		reportView ||
		layout ||
		routePreview(id) ||
		/(?:harness-(navbar|header|console|shell)|harness-screen|workspace-shell|hosted-workspace)$/.test(
			id
		);
	const explorer =
		(id === 'reports.component.networking-security-explorer-permissions-screen' &&
			variant.startsWith('endpoint')) ||
		Boolean(unit.source?.includes('/components/explorer-ui/')) ||
		Boolean(unit.source?.includes('/components/module-system/plugins/')) ||
		[
			'explorer-catalog-items',
			'explorer-function-card',
			'explorer-usage',
			'explorer-usage-link',
			'source-code-action',
			'source-file-list',
			'source-viewer',
			'shared-primitives-compare-panes'
		].some((name) => id === `reports.component.${name}`);
	const reports = id.startsWith('reports.');
	const historyColumns = ['Date', 'Commit', 'Behavior change', 'Size', 'Complexity', 'Latency'];
	// The fit control acts on a checkpoint flow, so it is shown in the controls of one, as GameGraph
	// shows it: the checkpoints of the example game, not a project's.
	const fitted = id === 'desktop.component.game-authoring-game-graph-fit';
	let flowNodes = $state.raw<Node[]>(
		exampleDocument().views[0].checkpoints.map((point) => ({
			id: point.id,
			position: { x: point.x, y: point.y },
			data: { label: point.title }
		}))
	);
	let flowEdges = $state.raw<Edge[]>([]);
	setContext(key, fixture.hub);
	setContext(remoteContext, fixture.remote);
	if (id === 'desktop.page.tracker')
		setContext<NativeAccountContext>(nativeAccountContext, {
			environment: { kind: 'capacitor', bridge: undefined, local: false, tracker: previewTracker },
			signedIn: true,
			signOut: () => {}
		});
	// These pages use the signed-in environment their layout supplies.
	if (['desktop.page.designs', 'desktop.page.root'].includes(id))
		setContext<NativeAccountContext>(nativeAccountContext, {
			environment: {
				kind: 'electron',
				bridge: (window as Window & EnvironmentHost).harness,
				local: true
			},
			signedIn: true,
			accountName: 'Ada Morgan',
			signOut: () => {}
		});
	onDestroy(fixture.cleanup);
</script>

<div class="preview-catalog" class:hx-shell={reports} class:hub-page={id.startsWith('hub.')}>
	<main
		class="preview-main"
		class:hx-main={reports}
		class:full-frame={fullFrame}
		class:gallery-section={galleryCard && !compactEvidence}
		class:states-gallery={compactEvidence}
	>
		<h1 id="preview-title" class:preview-hidden={routePreview(id) || reportView}>{unit.title}</h1>
		{#await fixture.ready}<p role="status">Preparing component preview…</p>{:then}
			<div
				class="preview-content"
				class:upload-audio={id === 'reports.component.audio-upload-files'}
				class:evidence-grid={galleryCard}
				class:provider-picker={id.includes('provider-picker')}
				class:account={id === 'hub.component.account-menu'}
				class:desktop-status={id === 'reports.component.harness-harness-verdict' &&
					variant.startsWith('icon')}
				class:ex-content={explorer && !fullFrame}
				data-preview-unit={unit.id}
				data-preview-frame={fullFrame ? 'full' : 'component'}
			>
				<!-- SYNTHETIC child: what a layout is given in place of a page, said so where drawn. -->
				{#snippet layoutChild()}
					<section class="preview-child" aria-labelledby="preview-child-label">
						<div class="preview-child-icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" width="26" height="26">
								<rect x="3" y="4" width="18" height="16" rx="2" />
								<path d="M3 9h18" />
								<rect class="preview-child-slot" x="7" y="12" width="10" height="5" rx="1" />
							</svg>
						</div>
						<p class="preview-child-label" id="preview-child-label">Child content</p>
						<p class="preview-child-hint">Your page renders here</p>
					</section>
				{/snippet}
				{#if Root}
					<Root><Component {...fixture.props} children={layoutChild} /></Root>
				{:else if id === 'reports.component.harness-entity-history-row'}
					<div class="ex-scroll">
						<table class="ex-table ex-history" aria-label="History row preview">
							<thead
								><tr
									>{#each historyColumns as column (column)}<th>{column}</th>{/each}</tr
								></thead
							>
							<tbody><Component {...fixture.props} /></tbody>
						</table>
					</div>
				{:else if id === 'reports.component.harness-explorer-index'}
					<ExplorerIndexPreview props={fixture.props as never} />
				{:else if id === 'reports.component.harness-explorer-frame' && ['source-open', 'registry-optional'].includes(variant)}
					<ExplorerFramePreview props={fixture.props as never} />
				{:else if id === 'reports.component.harness-harness-selectors' && ['tip', 'at-tip'].includes(variant)}
					<div class="hx-nav"><Component {...fixture.props} /></div>
				{:else if id in presentationIds}
					<PresentationPreviews {id} {variant} />
				{:else if id === 'desktop.component.shared-primitives-choice-rows'}
					<Component {...fixture.props}>
						<ChoiceRow name="Main" meta="Current branch" current onchoose={noop} />
						<ChoiceRow name="Order history" meta="Feature branch" onchoose={noop} />
					</Component>
				{:else if id.startsWith('reports.component.planning-collaboration-design-canvas-')}
					<div class="design-preview-host" data-design={id.split('-').at(-1)}>
						<Component {...fixture.props} />
					</div>
				{:else if fitted}
					<div class="flow-host">
						<SvelteFlow bind:nodes={flowNodes} bind:edges={flowEdges} colorMode="dark" fitView>
							<Controls showLock={false} showFitView={false}>
								<Component {...fixture.props} />
							</Controls>
						</SvelteFlow>
					</div>
				{:else if isHubHomePreview(id)}
					<HubHomeCatalogPreview {id} {Component} />
				{:else if id === 'desktop.component.development-tooling-tracker-inbox-tracker-inbox-choices'}
					<!-- Choice styles are scoped to the inbox, which holds them on rows and in the detail. -->
					<div class="inbox detail"><Component {...fixture.props} /></div>
				{:else if unit.source?.includes('/atoms/')}
					<NativeAtomPreview {Component} source={unit.source} {variant} />
				{:else}
					<Component {...fixture.props} />
				{/if}
			</div>
		{/await}
	</main>
</div>

<style>
	@import './catalogPreviews.css';
</style>
