<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_bvzniqukxj -->
<script lang="ts">
	import type { ArtboardTheme } from '../../../utils/planning-collaboration/designCanvas.types';
	let {
		title,
		scale,
		theme,
		selected,
		onzoom,
		onfit,
		ontheme,
		onopen
	}: {
		title: string;
		scale: number;
		theme: ArtboardTheme;
		selected: string | null;
		onzoom: (factor: number) => void;
		onfit: () => void;
		ontheme: (theme: ArtboardTheme) => void;
		onopen: () => void;
	} = $props();
</script>

<hx-div class="design-toolbar" role="toolbar" aria-label="Canvas">
	<hx-strong>{title}</hx-strong>
	<hx-span class="design-selected" aria-live="polite">{selected ?? ''}</hx-span>
	<hx-button type="button" disabled={!selected} onclick={onopen}>Open</hx-button>
	<hx-button type="button" aria-label="Zoom out" onclick={() => onzoom(1 / 1.25)}>−</hx-button>
	<hx-span class="design-zoom">{Math.round(scale * 100)}%</hx-span>
	<hx-button type="button" aria-label="Zoom in" onclick={() => onzoom(1.25)}>+</hx-button>
	<hx-button type="button" onclick={onfit}>Fit</hx-button>
	<hx-button
		type="button"
		aria-pressed={theme === 'dark'}
		onclick={() => ontheme(theme === 'dark' ? 'light' : 'dark')}>Dark</hx-button
	>
</hx-div>

<style>
	.design-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--hx-space-8);
		padding: var(--hx-space-8) var(--hx-space-16);
		background: var(--design-panel, var(--hx-color-surface));
		border-bottom: var(--hx-border-thin) solid var(--design-line, var(--hx-color-border-strong));
	}
	.design-selected {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		opacity: var(--hx-opacity-secondary);
	}
	.design-zoom {
		min-width: 4ch;
		text-align: right;
		font-variant-numeric: var(--hx-style-numeric-tabular);
	}
	button {
		min-height: 36px;
		min-width: 36px;
		padding: 0 var(--hx-space-12);
		border: var(--hx-border-thin) solid var(--design-line, var(--hx-color-border-strong));
		border-radius: var(--hx-radius-small);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button:disabled {
		opacity: var(--hx-opacity-disabled);
		cursor: default;
	}
	button[aria-pressed='true'] {
		border-color: var(--hx-color-primary);
		background: var(--hx-color-primary-soft);
	}
</style>
