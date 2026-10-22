<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import Modal from './Modal.svelte';
	import HarnessIcon from '../explorer-ui/harness/HarnessIcon.svelte';
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

<div class="catalog-filter-dialog">
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
		border: 1px solid var(--line, #2c4259);
		border-radius: 8px;
		background: var(--panel, #102131);
		color: var(--muted, #9fb0c6);
		cursor: pointer;
	}
	.filter-trigger:hover,
	.filter-trigger.active {
		border-color: var(--gold, #f3c33b);
		color: var(--gold, #f3c33b);
	}
	.filter-trigger:focus-visible {
		outline: 2px solid var(--gold, #f3c33b);
		outline-offset: 2px;
	}
	.catalog-filter-dialog :global(.viewer-dialog[open]) {
		box-sizing: border-box;
		width: min(440px, calc(100vw - 32px));
		height: fit-content;
		max-height: calc(100dvh - 32px);
		padding: 0;
		border: 1px solid var(--line, #2c4259);
		border-radius: 14px;
		background: var(--panel, #102131);
		color: var(--text, #eef2f8);
		box-shadow: 0 24px 80px #0009;
	}
	.catalog-filter-dialog :global(.viewer-dialog::backdrop) {
		background: #030a0fc9;
		backdrop-filter: blur(3px);
	}
	.catalog-filter-dialog :global(.viewer-header) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 20px;
		border-bottom: 1px solid var(--line, #2c4259);
		background: transparent;
	}
	.catalog-filter-dialog :global(.viewer-header h2) {
		margin: 0;
		font-size: 18px;
	}
	.catalog-filter-dialog :global(.viewer-header button) {
		width: 40px;
		height: 40px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: inherit;
		font-size: 24px;
		cursor: pointer;
	}
	.catalog-filter-dialog :global(.viewer-content) {
		padding: 20px;
	}
	.filter-fields {
		display: grid;
		gap: 18px;
	}
	.filter-fields :global(.filter-field) {
		display: grid;
		gap: 7px;
		font-size: 14px;
	}
	.filter-fields :global(.report-select) {
		display: block;
	}
	.filter-fields :global(select) {
		box-sizing: border-box;
		width: 100%;
		min-height: 44px;
		padding: 8px 42px 8px 12px;
		border: 1px solid var(--line, #2c4259);
		border-radius: 8px;
		background: var(--bg, #0c1a26);
		color: inherit;
		font: inherit;
	}
	.filter-fields :global(input[type='checkbox']) {
		accent-color: var(--gold, #f3c33b);
	}
	.catalog-filter-dialog :global(footer) {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 16px 20px;
		border-top: 1px solid var(--line, #2c4259);
	}
	.filter-reset,
	.filter-done {
		min-height: 44px;
		padding: 8px 16px;
		border: 1px solid var(--line, #2c4259);
		border-radius: 8px;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.filter-done {
		border-color: var(--gold, #f3c33b);
		color: var(--gold, #f3c33b);
	}
</style>
