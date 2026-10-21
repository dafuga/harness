<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity } from '../../models/Explorer.types';
	import type { EntityMeasure } from '../../utils/entityMeasure';
	import EntitySummary from './EntitySummary.svelte';
	let {
		entity,
		measure,
		children
	}: {
		entity: ExplorerEntity;
		measure: EntityMeasure;
		/** The evidence of the kind of the entity: what is seen, what is run, or what is set. */
		children: Snippet;
	} = $props();
	// What is seen opens the overview; what is run or set follows the summary it is read against.
	const seen = ['pages', 'components', 'shells'];
	let first = $derived(seen.includes(entity.category));
</script>

<!-- Contract, Used In and Uses are tabs of their own; an overview does not repeat them. -->
<!-- A stack, so the description, the evidence and the profile each stand 16px apart. -->
<div role="tabpanel" class="ex-stack" aria-label={`${entity.name} overview`}>
	{#if entity.category === 'pages' && entity.purpose}
		<p class="ex-lead">{entity.purpose}</p>
	{/if}
	{#if first}{@render children()}{/if}
	<EntitySummary {measure} compact />
	{#if !first}{@render children()}{/if}
</div>
