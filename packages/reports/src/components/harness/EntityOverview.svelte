<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity, ExplorerRelations } from '../../models/Explorer.types';
	import type { ContractRow } from '../../utils/entityContract';
	import { entityLens, type EntityNav } from '../../utils/entityLens';
	import type { EntityMeasure } from '../../utils/entityMeasure';
	import EntityLink from './EntityLink.svelte';
	import EntitySummary from './EntitySummary.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	let {
		entity,
		relations,
		contract,
		measure,
		nav,
		children
	}: {
		entity: ExplorerEntity;
		relations: ExplorerRelations;
		contract: ContractRow[];
		measure: EntityMeasure;
		nav: EntityNav;
		/** The evidence of the kind of the entity: what is seen, what is run, or what is set. */
		children: Snippet;
	} = $props();
</script>

<div role="tabpanel" aria-label={`${entity.name} overview`}>
	<EntitySummary {contract} {measure} compact last={entity.lastAt} />
	{#if entity.category === 'pages' && relations.components.length}
		<section class="ex-card ex-strip" aria-label="Components on this page">
			<h2><HarnessIcon name="layers" size={22} /> Components on this page</h2>
			<ul class="ex-links inline">
				{#each relations.components as item (item.id)}
					<li>
						<EntityLink
							to={entityLens(nav.route, { category: 'components', entity: item.id })}
							{nav}>{item.name}</EntityLink
						>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
	{@render children()}
</div>
