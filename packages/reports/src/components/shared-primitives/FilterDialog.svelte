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

<div class="catalog-filter-dialog" data-harness-component="filter-dialog">
	<button
		bind:this={trigger}
		type="button"
		class="filter-trigger"
		class:active={active > 0}
		aria-label="Filters"
		aria-haspopup="dialog"
		aria-expanded={opened}
		title={active ? `Filters · ${active} active` : 'Filters'}
		onclick={() => (opened = true)}><HarnessIcon name="state" size={21} /></button
	>
	<Modal open={opened} title="Filters" variant="text" onClose={close}>
		<div class="filter-fields">{@render children()}</div>
		{#snippet footer()}
			<button class="filter-reset" type="button" onclick={onreset}>Reset filters</button>
			<button class="filter-done" type="button" onclick={close}>Done</button>
		{/snippet}
	</Modal>
</div>

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
		border: var(--hx-border-thin) solid var(--line, var(--hx-line-strong));
		border-radius: var(--hx-radius-small);
		background: var(--panel, var(--hx-surface));
		color: var(--muted, var(--hx-muted));
		cursor: pointer;
	}
	.filter-trigger:hover,
	.filter-trigger.active {
		border-color: var(--gold, var(--hx-gold));
		color: var(--gold, var(--hx-gold));
	}
	.filter-trigger:focus-visible {
		outline: var(--hx-border-thick) solid var(--gold, var(--hx-gold));
		outline-offset: var(--hx-border-thick);
	}
	.catalog-filter-dialog :global(.viewer-dialog[open]) {
		box-sizing: border-box;
		width: min(440px, calc(100vw - 32px));
		height: fit-content;
		max-height: calc(100dvh - 32px);
		padding: 0;
		border: var(--hx-border-thin) solid var(--line, var(--hx-line-strong));
		border-radius: var(--hx-radius-xlarge);
		background: var(--panel, var(--hx-surface));
		color: var(--text, var(--hx-text));
		box-shadow: var(--hx-shadow-dialog);
	}
	.catalog-filter-dialog :global(.viewer-dialog::backdrop) {
		background: var(--hx-scrim);
		backdrop-filter: blur(3px);
	}
	.catalog-filter-dialog :global(.viewer-header) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--hx-space-16);
		padding: var(--hx-space-12) var(--hx-space-20);
		border-bottom: var(--hx-border-thin) solid var(--line, var(--hx-line-strong));
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
		border: var(--hx-border-thin) solid var(--line, var(--hx-line-strong));
		border-radius: var(--hx-radius-small);
		background: var(--bg, var(--hx-bg));
		color: inherit;
		font: inherit;
	}
	.filter-fields :global(input[type='checkbox']) {
		accent-color: var(--gold, #f3c33b);
	}
	.catalog-filter-dialog :global(footer) {
		display: flex;
		justify-content: space-between;
		gap: var(--hx-space-12);
		padding: var(--hx-space-16) var(--hx-space-20);
		border-top: var(--hx-border-thin) solid var(--line, var(--hx-line-strong));
	}
	.filter-reset,
	.filter-done {
		min-height: 44px;
		padding: var(--hx-space-8) var(--hx-space-16);
		border: var(--hx-border-thin) solid var(--line, var(--hx-line-strong));
		border-radius: var(--hx-radius-small);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.filter-done {
		border-color: var(--gold, var(--hx-gold));
		color: var(--gold, var(--hx-gold));
	}
</style>
