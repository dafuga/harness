<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_3t5ragqzvc -->
<script lang="ts">
	import { untrack } from 'svelte';
	import type {
		ArtboardTheme,
		CanvasView,
		DesignCanvasData
	} from '../../../utils/planning-collaboration/designCanvas.types';
	import { fitView, zoomAt } from '../../../utils/planning-collaboration/fitView';
	import ArtboardFrame from './ArtboardFrame.svelte';
	import ArtboardFull from './ArtboardFull.svelte';
	import CanvasToolbar from './CanvasToolbar.svelte';
	import { canvasGestures } from './canvasGestures';
	let { canvas, theme: initial }: { canvas: DesignCanvasData; theme?: ArtboardTheme } = $props();
	let theme = $state<ArtboardTheme>(untrack(() => initial) ?? preferred());
	let view = $state<CanvasView>({ x: 0, y: 0, scale: 1 });
	let size = $state({ width: 0, height: 0 });
	let selected = $state<string | null>(null);
	let opened = $state<string | null>(null);
	/** Until someone pans or zooms, a resized window keeps the whole canvas in view. */
	let moved = false;
	const openBoard = $derived(canvas.boards.find((board) => board.file === opened) ?? null);
	function preferred(): ArtboardTheme {
		const light = globalThis.matchMedia?.('(prefers-color-scheme: light)').matches;
		return light ? 'light' : 'dark';
	}
	function fit() {
		moved = false;
		view = fitView(canvas.boards, size);
	}
	function move(next: CanvasView) {
		moved = true;
		view = next;
	}
	const zoom = (factor: number) =>
		move(zoomAt(view, { x: size.width / 2, y: size.height / 2 }, factor));
	$effect(() => {
		void canvas.name;
		untrack(() => {
			selected = opened = null;
			moved = false;
		});
	});
	$effect(() => {
		if (size.width && canvas.boards) untrack(() => !moved && fit());
	});
</script>

<hx-div class="design-canvas" data-theme={theme}>
	<CanvasToolbar
		title={canvas.title}
		scale={view.scale}
		{theme}
		selected={canvas.boards.find((board) => board.file === selected)?.title ?? null}
		onzoom={zoom}
		onfit={fit}
		ontheme={(next) => (theme = next)}
		onopen={() => (opened = selected)}
	/>
	<!-- The stage takes keys and gestures; every artboard on it is also a button. -->
	<hx-div
		class="design-stage"
		role="application"
		aria-label={`${canvas.title} canvas. Arrow keys pan, plus and minus zoom, zero fits.`}
		tabindex="0"
		bind:clientWidth={size.width}
		bind:clientHeight={size.height}
		use:canvasGestures={{ view: () => view, move, zoom, fit, clear: () => (selected = null) }}
	>
		<hx-div
			class="design-world"
			style={`transform: translate(${view.x}px, ${view.y}px) scale(${view.scale})`}
		>
			{#each canvas.boards as item (item.file)}
				<ArtboardFrame
					board={item}
					{theme}
					scale={view.scale}
					selected={selected === item.file}
					onselect={() => (selected = item.file)}
					onopen={() => (selected = opened = item.file)}
				/>
			{/each}
		</hx-div>
		{#if !canvas.boards.length}
			<hx-p class="design-empty">This canvas has no artboards yet.</hx-p>
		{/if}
	</hx-div>
	{#if openBoard}
		<ArtboardFull board={openBoard} {theme} onclose={() => (opened = null)} />
	{/if}
</hx-div>

<style>
	.design-canvas {
		--design-ground: var(--hx-color-background);
		--design-panel: var(--hx-color-surface);
		--design-ink: var(--hx-color-text);
		--design-line: var(--hx-color-border-strong);
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		height: 100%;
		background: var(--design-ground);
		color: var(--design-ink);
	}
	.design-canvas[data-theme='light'] {
		--design-ground: color-mix(in srgb, var(--hx-color-text) 90%, var(--hx-color-primary));
		--design-panel: var(--hx-color-text);
		--design-ink: var(--hx-color-background);
		--design-line: color-mix(in srgb, var(--hx-color-background) 28%, var(--hx-color-text));
	}
	.design-stage {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		touch-action: none;
		cursor: grab;
		user-select: none;
	}
	.design-world {
		position: absolute;
		inset: 0 auto auto 0;
		transform-origin: 0 0;
	}
	.design-empty {
		padding: var(--hx-space-6, 24px);
		text-align: center;
	}
</style>
