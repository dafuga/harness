<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity, ExplorerRelations } from '../../models/Explorer.types';
	import type { ContractRow } from '../../utils/entityContract';
	import type { EntityNav } from '../../utils/entityLens';
	import type { EntityMeasure } from '../../utils/entityMeasure';
	import EntityRelations from './EntityRelations.svelte';
	import EntitySummary from './EntitySummary.svelte';
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
	<EntityRelations {relations} {nav} compact removed={entity.change === 'removed'} />
	{@render children()}
</div>
