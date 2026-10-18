<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity } from '../../models/Explorer.types';
	import type { ContractRow } from '../../utils/entityContract';
	import type { EntityMeasure } from '../../utils/entityMeasure';
	import EntitySummary from './EntitySummary.svelte';
	let {
		entity,
		contract,
		measure,
		children
	}: {
		entity: ExplorerEntity;
		contract: ContractRow[];
		measure: EntityMeasure;
		/** The evidence of the kind of the entity: what is seen, what is run, or what is set. */
		children: Snippet;
	} = $props();
	// What is seen opens the overview; what is run or set follows the summary it is read against.
	const seen = ['pages', 'components', 'shells'];
	let first = $derived(seen.includes(entity.category));
</script>

<!-- Used In and Uses are tabs of their own; an overview does not repeat them. -->
<div role="tabpanel" aria-label={`${entity.name} overview`}>
	{#if first}{@render children()}{/if}
	<EntitySummary {contract} {measure} compact last={entity.lastAt} />
	{#if !first}{@render children()}{/if}
</div>
