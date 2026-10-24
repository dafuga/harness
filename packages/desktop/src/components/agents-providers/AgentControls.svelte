<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import Select from '../../../../reports/src/components/Select.svelte';
	import type { Snippet } from 'svelte';
	import type { ProviderId, ProviderState } from '../../models/development-tooling/Desktop.types';
	import type { AgentChoice } from '../../utils/explorer-ui/composeModes';
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

{#if compact}<hx-div class="composer-bottom agent-icons">
		<AgentModelPicker {providers} bind:provider bind:model /><AgentEffortPicker
			efforts={selected?.efforts ?? []}
			bind:effort
		/>{@render action()}
	</hx-div>{:else}<hx-div class="provider-options" role="group" aria-label="Agent">
		{#each providers as item (item.id)}<hx-button
				type="button"
				class:active={provider === item.id}
				aria-pressed={provider === item.id}
				disabled={!item.available}
				title={item.reason || item.label}
				onclick={() => (provider = item.id)}>{item.label}</hx-button
			>{/each}
	</hx-div>
	<hx-div class="composer-bottom">
		<Select label="Model" bind:value={model} disabled={!current?.available}
			>{#each current?.models || [] as item (item.id)}<hx-option value={item.id}
					>{item.label}</hx-option
				>{/each}</Select
		><Select label="Reasoning effort" bind:value={effort} disabled={!selected?.efforts.length}
			>{#each selected?.efforts || [] as item (item)}<hx-option value={item}>{item}</hx-option
				>{/each}{#if !selected?.efforts.length}<hx-option value="">Default effort</hx-option
				>{/if}</Select
		>{@render action()}
	</hx-div>{/if}
{#if current?.reason}<hx-small>{current.reason}</hx-small>{/if}{#if !providers.length}<hx-small
		>No agent provider available.</hx-small
	>{/if}
