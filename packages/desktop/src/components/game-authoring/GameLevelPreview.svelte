<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { Action } from 'svelte/action';
	import { create2d, create3d, createRun } from '../../../../game/src/index';
	import type { GameLevelPreviewProps as Props, LevelFrame } from './GameLevelPreview.types';
	/**
	 * A layout drawn by the game's own 2D or 3D renderer, the player standing at its spawn point.
	 * Nothing steps here: a proposal is looked at, never played, until it is approved and built.
	 */
	let { layout, dimension, label }: Props = $props();
	const frame = $derived.by<LevelFrame>(() => {
		const start = createRun();
		const state = { ...start.state, x: layout.spawn.x, y: layout.spawn.z };
		const view = { id: 'level-preview', title: label, dimension, style: '', checkpoints: [] };
		return { run: { ...start, state }, view: { ...view, world: layout } };
	});
	/** One renderer per canvas, since a 2D context and WebGL cannot share an element. */
	const paint: Action<HTMLCanvasElement, LevelFrame> = (canvas, first) => {
		const source = first.view.dimension === '3d' ? create3d(canvas) : create2d(canvas);
		source.render(first.run, first.view);
		return {
			update: (next) => source.render(next.run, next.view),
			destroy: () => source.dispose()
		};
	};
</script>

<hx-div class="level-preview" data-harness-component="game-level-preview">
	{#key dimension}
		<hx-canvas use:paint={frame} data-level-preview width="1280" height="704" aria-label={label}
		></hx-canvas>
	{/key}
</hx-div>

<style>
	.level-preview {
		min-width: 0;
	}
	canvas {
		display: block;
		width: 100%;
		height: auto;
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-large);
		background: var(--hx-color-background);
	}
</style>
