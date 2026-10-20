<script lang="ts">
	import Select from '../../../reports/src/components/Select.svelte';
	import type { Snippet } from 'svelte';
	import type { ProviderId, ProviderState } from '../models/Desktop.types';
	import type { AgentChoice } from '../utils/composeModes';
	import AgentEffortPicker from './AgentEffortPicker.svelte';
	import AgentModelPicker from './AgentModelPicker.svelte';
	/**
	 * Rendered only for Plan and Change, in a context whose capabilities allow agents. Compact, the
	 * model and its reasoning effort are icons that open pickers. How many designs a Plan asks for
	 * is a device setting, never chosen here.
	 */
	let {
		providers,
		choice = $bindable(null),
		compact = false,
		action
	}: {
		providers: ProviderState[];
		choice?: AgentChoice | null;
		compact?: boolean;
		action: Snippet;
	} = $props();
	let provider = $state<ProviderId>('codex');
	let model = $state('');
	let effort = $state('');
	const current = $derived(providers.find((p) => p.id === provider));
	const selected = $derived(current?.models.find((m) => m.id === model));
	/** The picker lists every provider, so one that cannot be used gives way to one that can. */
	$effect(() => {
		if (compact && !current?.available)
			provider = providers.find((p) => p.available)?.id ?? provider;
	});
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

{#if compact}<div class="composer-bottom agent-icons">
		<AgentModelPicker {providers} bind:provider bind:model /><AgentEffortPicker
			efforts={selected?.efforts ?? []}
			bind:effort
		/>{@render action()}
	</div>{:else}<div class="provider-options" role="group" aria-label="Agent">
		{#each providers as item (item.id)}<button
				type="button"
				class:active={provider === item.id}
				aria-pressed={provider === item.id}
				disabled={!item.available}
				title={item.reason || item.label}
				onclick={() => (provider = item.id)}>{item.label}</button
			>{/each}
	</div>
	<div class="composer-bottom">
		<Select label="Model" bind:value={model} disabled={!current?.available}
			>{#each current?.models || [] as item (item.id)}<option value={item.id}>{item.label}</option
				>{/each}</Select
		><Select label="Reasoning effort" bind:value={effort} disabled={!selected?.efforts.length}
			>{#each selected?.efforts || [] as item (item)}<option value={item}>{item}</option
				>{/each}{#if !selected?.efforts.length}<option value="">Default effort</option>{/if}</Select
		>{@render action()}
	</div>{/if}
{#if current?.reason}<small>{current.reason}</small>{/if}{#if !providers.length}<small
		>No agent provider available.</small
	>{/if}
