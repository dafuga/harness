<!-- @harness-tier organism -->
<!-- @harness-atoms atoms -->
<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import Modal from './Modal.svelte';
	import HarnessIcon from '../explorer-ui/HarnessIcon.svelte';
	let {
		active = 0,
		onreset,
		children
	}: {
		active?: number;
		onreset: () => void;
		children: Snippet;
	} = $props();
	let opened = $state(false);
	let trigger = $state<HTMLButtonElement>();
	async function close() {
		opened = false;
		await tick();
		trigger?.focus();
	}
</script>

<hx-div class="catalog-filter-dialog" data-harness-component="filter-dialog">
	<hx-button
		bind:this={trigger}
		type="button"
		class="filter-trigger"
		class:active={active > 0}
		aria-label="Filters"
		aria-haspopup="dialog"
		aria-expanded={opened}
		title={active ? `Filters · ${active} active` : 'Filters'}
		onclick={() => (opened = true)}><HarnessIcon name="state" size={21} /></hx-button
	>
	<Modal open={opened} title="Filters" variant="text" onClose={close}>
		<hx-div class="filter-fields">{@render children()}</hx-div>
		{#snippet footer()}
			<hx-button class="filter-reset" type="button" onclick={onreset}>Reset filters</hx-button>
			<hx-button class="filter-done" type="button" onclick={close}>Done</hx-button>
		{/snippet}
	</Modal>
</hx-div>

<style>
	.catalog-filter-dialog {
		flex: none;
	}
	.filter-trigger {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		padding: 0;
		border: var(--hx-border-thin) solid var(--hx-color-border, var(--hx-color-border-strong));
		border-radius: var(--hx-radius-small);
		background: var(--hx-color-surface, var(--hx-color-surface));
		color: var(--hx-color-text-muted, var(--hx-color-text-muted));
		cursor: pointer;
	}
	.filter-trigger:hover,
	.filter-trigger.active {
		border-color: var(--hx-color-primary);
		color: var(--hx-color-primary);
	}
	.filter-trigger:focus-visible {
		outline: var(--hx-border-thick) solid var(--hx-color-primary);
		outline-offset: var(--hx-border-thick);
	}
	.catalog-filter-dialog :global(.viewer-dialog[open]) {
		box-sizing: border-box;
		width: min(440px, calc(100vw - 32px));
		height: fit-content;
		max-height: calc(100dvh - 32px);
		padding: 0;
		border: var(--hx-border-thin) solid var(--hx-color-border, var(--hx-color-border-strong));
		border-radius: var(--hx-radius-xlarge);
		background: var(--hx-color-surface, var(--hx-color-surface));
		color: var(--text, var(--hx-color-text));
		box-shadow: var(--hx-shadow-dialog);
	}
	.catalog-filter-dialog :global(.viewer-dialog::backdrop) {
		background: var(--hx-color-scrim);
		backdrop-filter: var(--hx-effect-blur-subtle);
	}
	.catalog-filter-dialog :global(.viewer-header) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--hx-space-16);
		padding: var(--hx-space-12) var(--hx-space-20);
		border-bottom: var(--hx-border-thin) solid var(--hx-color-border, var(--hx-color-border-strong));
		background: transparent;
	}
	.catalog-filter-dialog :global(.viewer-header h2) {
		margin: 0;
		font-size: var(--hx-type-size-lg);
	}
	.catalog-filter-dialog :global(.viewer-header button) {
		width: 40px;
		height: 40px;
		border: 0;
		border-radius: var(--hx-radius-small);
		background: transparent;
		color: inherit;
		font-size: var(--hx-type-size-2xl);
		cursor: pointer;
	}
	.catalog-filter-dialog :global(.viewer-content) {
		padding: var(--hx-space-20);
	}
	.filter-fields {
		display: grid;
		gap: var(--hx-space-18);
	}
	.filter-fields :global(.filter-field) {
		display: grid;
		gap: var(--hx-space-7);
		font-size: var(--hx-type-size-sm);
	}
	.filter-fields :global(.report-select) {
		display: block;
	}
	.filter-fields :global(select) {
		box-sizing: border-box;
		width: 100%;
		min-height: 44px;
		padding: var(--hx-space-8) var(--hx-space-42) var(--hx-space-8) var(--hx-space-12);
		border: var(--hx-border-thin) solid var(--hx-color-border, var(--hx-color-border-strong));
		border-radius: var(--hx-radius-small);
		background: var(--bg, var(--hx-color-background));
		color: inherit;
		font: inherit;
	}
	.filter-fields :global(input[type='checkbox']) {
		accent-color: var(--hx-color-primary);
	}
	.catalog-filter-dialog :global(footer) {
		display: flex;
		justify-content: space-between;
		gap: var(--hx-space-12);
		padding: var(--hx-space-16) var(--hx-space-20);
		border-top: var(--hx-border-thin) solid var(--hx-color-border, var(--hx-color-border-strong));
	}
	.filter-reset,
	.filter-done {
		min-height: 44px;
		padding: var(--hx-space-8) var(--hx-space-16);
		border: var(--hx-border-thin) solid var(--hx-color-border, var(--hx-color-border-strong));
		border-radius: var(--hx-radius-small);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.filter-done {
		border-color: var(--hx-color-primary);
		color: var(--hx-color-primary);
	}
</style>
