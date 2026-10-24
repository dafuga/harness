<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { ProviderId, ProviderState } from '../../models/development-tooling/Desktop.types';
	import ChoiceDialog from '../shared-primitives/ChoiceDialog.svelte';
	import Icon from '../shared-primitives/Icon.svelte';
	/**
	 * One icon opens every discovered provider's models together. A choice names the provider and
	 * the model it listed, unchanged; a provider that cannot be used shows why and offers nothing.
	 */
	let {
		providers,
		provider = $bindable(),
		model = $bindable()
	}: { providers: ProviderState[]; provider: ProviderId; model: string } = $props();
	const current = $derived(providers.find((item) => item.id === provider));
	const named = $derived(current?.models.find((item) => item.id === model)?.label);
	const tip = $derived(current && named ? `Model: ${current.label} · ${named}` : 'Choose model');
	function choose(next: ProviderId, id: string, close: () => void) {
		provider = next;
		model = id;
		close();
	}
</script>

<ChoiceDialog label="Choose model" title={tip} width={320} maxHeight={480} gap={14}>
	{#snippet icon()}<Icon name="model" size={18} />{/snippet}
	{#snippet children(close: () => void)}
		{#each providers as item (item.id)}<hx-section>
				<hx-h2>{item.label}</hx-h2>
				{#if item.reason}<hx-small>{item.reason}</hx-small>{/if}
				{#each item.models as option (option.id)}<hx-button
						type="button"
						class:active={item.id === provider && option.id === model}
						aria-pressed={item.id === provider && option.id === model}
						disabled={!item.available}
						onclick={() => choose(item.id, option.id, close)}>{option.label}</hx-button
					>{/each}
				{#if item.available && !item.models.length}<hx-small>No models listed.</hx-small>{/if}
			</hx-section>{/each}
		{#if !providers.length}<hx-small>No agent provider available.</hx-small>{/if}
	{/snippet}
</ChoiceDialog>

<style>
	section {
		display: grid;
		gap: var(--hx-space-6);
	}
	h2 {
		margin: 0;
		font-size: var(--hx-type-size-xs);
		color: var(--hx-color-primary);
	}
	small {
		color: var(--hx-color-text-muted);
	}
</style>
