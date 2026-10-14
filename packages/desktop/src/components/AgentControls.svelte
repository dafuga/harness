<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { Snippet } from 'svelte';
	import type { ProviderId, ProviderState } from '../models/Desktop.types';
	import { defaultDesignCount, designCounts, type AgentChoice } from '../utils/composeModes';
	/**
	 * Rendered only for Plan and Change, in a context whose capabilities allow agents. A Plan of
	 * a visual unit also chooses how many design options it asks for, beside the model.
	 */
	let {
		providers,
		choice = $bindable(null),
		count = $bindable(defaultDesignCount),
		counted = false,
		action
	}: {
		providers: ProviderState[];
		choice?: AgentChoice | null;
		count?: number;
		counted?: boolean;
		action: Snippet;
	} = $props();
	let provider = $state<ProviderId>('codex');
	let model = $state('');
	let effort = $state('');
	const current = $derived(providers.find((p) => p.id === provider));
	const selected = $derived(current?.models.find((m) => m.id === model));
	$effect(() => {
		if (!current?.models.some((m) => m.id === model))
			model = current?.models.find((m) => m.isDefault)?.id || current?.models[0]?.id || '';
	});
	$effect(() => {
		if (!selected?.efforts.includes(effort))
			effort = selected?.defaultEffort || selected?.efforts[0] || '';
	});
	$effect(() => {
		choice = current?.available && model ? { provider, model, effort: effort || null } : null;
	});
</script>

<div class="provider-options">
	{#each providers as item (item.id)}<button
			type="button"
			class:active={provider === item.id}
			disabled={!item.available}
			title={item.reason || item.label}
			onclick={() => (provider = item.id)}>{item.label}</button
		>{/each}
</div>
<div class="composer-bottom" class:counted>
	<Select label="Model" bind:value={model} disabled={!current?.available}
		>{#each current?.models || [] as item (item.id)}<option value={item.id}>{item.label}</option
			>{/each}</Select
	><Select label="Reasoning effort" bind:value={effort} disabled={!selected?.efforts.length}
		>{#each selected?.efforts || [] as item (item)}<option value={item}>{item}</option
			>{/each}{#if !selected?.efforts.length}<option value="">Default effort</option>{/if}</Select
	>{#if counted}<Select
			label="Design options"
			bind:value={() => String(count), (value) => (count = Number(value))}
			>{#each designCounts as item (item)}<option value={String(item)}
					>{item} {item === 1 ? 'design' : 'designs'}</option
				>{/each}</Select
		>{/if}{@render action()}
</div>
{#if current?.reason}<small>{current.reason}</small>{/if}{#if !providers.length}<small
		>No agent provider available.</small
	>{/if}
