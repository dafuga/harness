<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_mzorbd5tem -->
<script lang="ts">
	import type {
		ArtboardTheme,
		CanvasBoard
	} from '../../../utils/planning-collaboration/designCanvas.types';
	import { fullScale } from '../../../utils/planning-collaboration/fitView';
	import SandboxedArtboard from './SandboxedArtboard.svelte';
	let { board, theme, onclose }: { board: CanvasBoard; theme: ArtboardTheme; onclose: () => void } =
		$props();
	let room = $state({ width: 0, height: 0 });
	let actual = $state(false);
	const scale = $derived(actual || !room.width ? 1 : fullScale(board, room));
	const modal = (node: HTMLDialogElement) => {
		node.showModal();
		return { destroy: () => node.close() };
	};
</script>

<hx-dialog class="design-full" aria-label={board.title} use:modal {onclose}>
	<hx-header>
		<hx-strong>{board.title}</hx-strong>
		<hx-span>{board.width}×{board.height} · {Math.round(scale * 100)}%</hx-span>
		<hx-button type="button" aria-pressed={actual} onclick={() => (actual = !actual)}>
			Actual size
		</hx-button>
		<hx-button type="button" onclick={onclose}>Close</hx-button>
	</hx-header>
	<hx-div class="design-room" bind:clientWidth={room.width} bind:clientHeight={room.height}>
		<hx-div
			class="design-sized"
			style={`width: ${board.width * scale}px; height: ${board.height * scale}px`}
		>
			<hx-div style={`transform: scale(${scale}); transform-origin: 0 0`}>
				{#if board.problem}<hx-p>{board.problem}</hx-p>{:else}<SandboxedArtboard
						{board}
						{theme}
					/>{/if}
			</hx-div>
		</hx-div>
	</hx-div>
</hx-dialog>

<style>
	.design-full {
		display: flex;
		flex-direction: column;
		width: 100vw;
		height: 100dvh;
		max-width: 100vw;
		max-height: 100dvh;
		margin: 0;
		padding: 0;
		border: 0;
		background: var(--design-ground, var(--hx-color-background));
		color: var(--design-ink, var(--hx-color-text));
	}
	header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 16px;
		background: var(--design-panel, var(--hx-color-surface));
		border-bottom: 1px solid var(--design-line, var(--hx-color-border-strong));
	}
	header span {
		flex: 1;
		opacity: 0.75;
	}
	button {
		min-height: 36px;
		padding: 0 12px;
		border: 1px solid var(--design-line, var(--hx-color-border-strong));
		border-radius: 8px;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button[aria-pressed='true'] {
		border-color: var(--hx-color-primary);
		background: var(--hx-color-primary-soft);
	}
	.design-room {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: auto;
	}
	.design-sized {
		flex: none;
		margin: auto;
		overflow: hidden;
	}
</style>
