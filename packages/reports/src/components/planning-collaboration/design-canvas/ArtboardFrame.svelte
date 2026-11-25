<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_osnyutv5hi -->
<script lang="ts">
	import type {
		ArtboardTheme,
		CanvasBoard
	} from '../../../utils/planning-collaboration/designCanvas.types';
	import SandboxedArtboard from './SandboxedArtboard.svelte';
	let {
		board,
		theme,
		scale,
		selected,
		onselect,
		onopen
	}: {
		board: CanvasBoard;
		theme: ArtboardTheme;
		scale: number;
		selected: boolean;
		onselect: () => void;
		onopen: () => void;
	} = $props();
	/** The title and outline keep one size on screen at every zoom. */
	const unit = $derived(1 / scale);
</script>

<hx-figure
	class="design-board"
	data-artboard={board.file}
	style={`left: ${board.x}px; top: ${board.y}px; width: ${board.width}px; height: ${board.height}px`}
>
	<hx-figcaption
		style={`font-size: ${12 * unit}px; max-width: ${board.width}px; margin-bottom: ${6 * unit}px`}
	>
		{board.title}
	</hx-figcaption>
	{#if board.problem}
		<hx-p class="design-problem" style={`font-size: ${12 * unit}px`}>{board.problem}</hx-p>
	{:else}
		<SandboxedArtboard {board} {theme} />
	{/if}
	<!-- The frame never takes a pointer or focus: this button over it does. -->
	<hx-button
		type="button"
		class="design-hit"
		aria-pressed={selected}
		aria-label={`${board.title}, ${board.width} by ${board.height}`}
		style={`outline-width: ${(selected ? 3 : 1) * unit}px`}
		onclick={() => (selected ? undefined : onselect())}
		ondblclick={onopen}
		onkeydown={(event: KeyboardEvent) => {
			if (event.key !== 'Enter' || !selected) return;
			event.preventDefault();
			onopen();
		}}
	></hx-button>
</hx-figure>

<style>
	.design-board {
		position: absolute;
		margin: 0;
	}
	figcaption {
		position: absolute;
		bottom: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-family: var(--hx-font-family-body);
	}
	.design-problem {
		margin: 0;
		padding: 8%;
		height: 100%;
		background: var(--design-panel);
	}
	.design-hit {
		position: absolute;
		inset: 0;
		width: 100%;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		outline: solid var(--design-line);
		cursor: pointer;
	}
	.design-hit[aria-pressed='true'],
	.design-hit:focus-visible {
		outline-color: var(--hx-color-primary);
	}
</style>
