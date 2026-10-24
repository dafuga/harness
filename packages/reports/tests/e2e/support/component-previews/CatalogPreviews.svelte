<script lang="ts">
	import { setContext, onDestroy, untrack } from 'svelte';
	import { Controls, SvelteFlow, type Edge, type Node } from '@xyflow/svelte';
	import { key } from '../../../../../hub/src/utils/browserContext';
	import { remoteContext } from '../../../../../desktop/src/models/Environment.types';
	import { exampleDocument } from '../../../../../game/src/index';
	import { previewUnits, previewComponent } from './units';
	import { previewFixture } from './fixtures.svelte';
	import { routePreview } from './visualUnits';
	import NativeAtomPreview from './NativeAtomPreview.svelte';
	let { id: requested }: { id: string } = $props();
	const id = untrack(() => requested);
	const unit = previewUnits.find((unit) => unit.id === id);
	if (!unit) throw new Error(`Unknown preview component ${id}`);
	const fixture = previewFixture(id);
	const Component = previewComponent(unit.source);
	// A layout frames a page, so it is given the marked child slot below and never a real page.
	const layout = unit.kind === 'layout';
	// It is drawn in the Reports root its pages are drawn in, so the chat that root keeps across them
	// is drawn with it; no other preview loads that root.
	const Root = layout ? previewComponent('packages/reports/src/routes/+layout.svelte') : null;
	// A route module draws a whole screen of its application, as the screen components do.
	const fullFrame =
		layout ||
		routePreview(id) ||
		/(?:harness-(navbar|header|console|shell)|harness-screen|workspace-shell|hosted-workspace)$/.test(
			id
		);
	// What the explorer draws inside its content, as it is drawn there.
	const explorer =
		Boolean(unit.source?.includes('/components/explorer-ui/')) ||
		[
			'explorer-catalog-items',
			'explorer-function-card',
			'explorer-usage',
			'explorer-usage-link',
			'source-code-action',
			'source-file-list',
			'source-viewer'
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
	onDestroy(fixture.cleanup);
</script>

<div class="preview-catalog" class:hx-shell={reports} class:hub-page={id.startsWith('hub.')}>
	<main class="preview-main" class:hx-main={reports} class:full-frame={fullFrame}>
		<h1 id="preview-title" class:preview-hidden={routePreview(id)}>{unit.title}</h1>
		{#await fixture.ready}<p role="status">Preparing component preview…</p>{:then}
			<div
				class="preview-content"
				class:provider-picker={id.includes('provider-picker')}
				class:account={id === 'hub.component.account-menu'}
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
				{:else if fitted}
					<div class="flow-host">
						<SvelteFlow bind:nodes={flowNodes} bind:edges={flowEdges} colorMode="dark" fitView>
							<Controls showLock={false} showFitView={false}>
								<Component {...fixture.props} />
							</Controls>
						</SvelteFlow>
					</div>
				{:else if unit.source?.includes('/atoms/')}
					<NativeAtomPreview {Component} source={unit.source} />
				{:else}
					<Component {...fixture.props} />
				{/if}
			</div>
		{/await}
	</main>
</div>

<style>
	h1 {
		overflow-wrap: anywhere;
	}
	.preview-catalog {
		min-height: 100vh;
	}
	.preview-hidden {
		display: none;
	}
	.preview-main:not(.hx-main) {
		min-width: 0;
		padding: 20px;
	}
	.preview-main.full-frame {
		padding: 0 0 64px;
	}
	.full-frame h1 {
		padding: 20px var(--hx-gutter, 20px) 0;
	}
	.preview-content {
		min-width: 0;
	}
	.preview-content :global(img) {
		max-width: 100%;
	}
	.flow-host {
		height: 380px;
	}
	/* The slot a layout draws its page in: a dashed frame in the theme, as tall as a short page. */
	.preview-child {
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 10px;
		box-sizing: border-box;
		min-width: 0;
		min-height: clamp(280px, 55vh, 560px);
		padding: 32px 20px;
		border: 2px dashed color-mix(in srgb, var(--gold) 55%, transparent);
		border-radius: var(--hx-radius, 10px);
		background:
			repeating-linear-gradient(
				135deg,
				color-mix(in srgb, var(--gold) 5%, transparent) 0 12px,
				transparent 12px 24px
			),
			var(--panel);
		text-align: center;
		overflow-wrap: anywhere;
	}
	.preview-child-icon {
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		margin-bottom: 4px;
		border: 1px solid color-mix(in srgb, var(--gold) 40%, transparent);
		border-radius: 50%;
		background: color-mix(in srgb, var(--gold) 12%, var(--panel));
		color: var(--gold);
	}
	.preview-child-icon svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.preview-child-slot {
		stroke-dasharray: 2 2;
	}
	.preview-child-label {
		margin: 0;
		color: var(--gold);
		font-size: 1.25rem;
		font-weight: 600;
		line-height: 1.3;
	}
	.preview-child-hint {
		margin: 0;
		color: var(--muted);
		font-size: 0.95rem;
	}
</style>
