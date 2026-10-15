<script lang="ts">
	import { tick } from 'svelte';
	import type { ProviderId, ProviderState } from '../models/Desktop.types';
	import Icon from './Icon.svelte';
	/**
	 * One icon opens every discovered provider's models together. A choice names the provider and
	 * the model it listed, unchanged; a provider that cannot be used shows why and offers nothing.
	 */
	let {
		providers,
		provider = $bindable(),
		model = $bindable()
	}: { providers: ProviderState[]; provider: ProviderId; model: string } = $props();
	let trigger = $state<HTMLButtonElement>();
	let dialog = $state<HTMLDialogElement>();
	const current = $derived(providers.find((item) => item.id === provider));
	const named = $derived(current?.models.find((item) => item.id === model)?.label);
	const tip = $derived(current && named ? `Model: ${current.label} · ${named}` : 'Choose model');
	async function open() {
		dialog?.showModal();
		await tick();
		dialog?.querySelector<HTMLButtonElement>('[aria-pressed="true"]:enabled')?.focus();
	}
	function choose(next: ProviderId, id: string) {
		provider = next;
		model = id;
		dialog?.close();
	}
	/** Escape closes the picker only, never the panel around it. */
	function keydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		dialog?.close();
	}
</script>

<button
	bind:this={trigger}
	type="button"
	class="agent-icon"
	aria-label="Choose model"
	aria-haspopup="dialog"
	title={tip}
	onclick={open}><Icon name="model" size={18} /></button
>
<dialog
	bind:this={dialog}
	class="agent-picker"
	aria-label="Choose model"
	onclick={(event) => event.target === event.currentTarget && dialog?.close()}
	onkeydown={keydown}
	onclose={() => trigger?.focus()}
>
	<div class="agent-picker-body">
		{#each providers as item (item.id)}<section>
				<h2>{item.label}</h2>
				{#if item.reason}<small>{item.reason}</small>{/if}
				{#each item.models as option (option.id)}<button
						type="button"
						class:active={item.id === provider && option.id === model}
						aria-pressed={item.id === provider && option.id === model}
						disabled={!item.available}
						onclick={() => choose(item.id, option.id)}>{option.label}</button
					>{/each}
				{#if item.available && !item.models.length}<small>No models listed.</small>{/if}
			</section>{/each}
		{#if !providers.length}<small>No agent provider available.</small>{/if}
	</div>
</dialog>

<style>
	.agent-picker {
		width: min(320px, calc(100vw - 24px));
		max-height: min(480px, calc(100dvh - 24px));
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--panel);
		color: inherit;
		overflow: auto;
	}
	.agent-picker::backdrop {
		background: rgb(3 26 40 / 0.6);
	}
	.agent-picker-body {
		display: grid;
		gap: 14px;
		padding: 14px;
	}
	section {
		display: grid;
		gap: 6px;
	}
	h2 {
		margin: 0;
		font-size: 12px;
		color: var(--gold);
	}
	small {
		color: var(--muted);
	}
	section button {
		justify-content: start;
		text-align: start;
	}
</style>
