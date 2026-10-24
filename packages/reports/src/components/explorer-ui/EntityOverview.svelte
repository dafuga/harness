<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity } from '../../models/explorer-ui/Explorer.types';
	import type { EntityMeasure } from '../../utils/explorer-ui/entityMeasure';
	import type { MetricComparison } from '../../utils/explorer-ui/metricChanges';
	import EntitySummary from './EntitySummary.svelte';
	let {
		entity,
		measure,
		comparison = null,
		children
	}: {
		entity: ExplorerEntity;
		measure: EntityMeasure;
		comparison?: MetricComparison | null;
		/** The evidence of the kind of the entity: what is seen, what is run, or what is set. */
		children: Snippet;
	} = $props();
	// What is seen opens the overview; what is run or set follows the summary it is read against.
	const seen = ['pages', 'components', 'layouts'];
	let first = $derived(seen.includes(entity.category));
</script>

<!-- Contract, Used In and Uses are tabs of their own; an overview does not repeat them. -->
<!-- A stack, so the description, the evidence and the profile each stand 16px apart. -->
<hx-div
	role="tabpanel"
	class="ex-stack"
	aria-label={`${entity.name} overview`}
	data-harness-component="harness-entity-overview"
>
	{#if entity.category === 'pages' && entity.purpose}
		<hx-p class="ex-lead">{entity.purpose}</hx-p>
	{/if}
	{#if first}{@render children()}{/if}
	<EntitySummary {measure} {comparison} compact />
	{#if !first}{@render children()}{/if}
</hx-div>
