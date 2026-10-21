<script lang="ts">
	import type { ExplorerEntity, ExplorerTab } from '../../models/Explorer.types';
	import type { HarnessRecord } from '../../models/Harness.types';
	import type { ContractRow } from '../../utils/entityContract';
	import type { EntityMeasure } from '../../utils/entityMeasure';
	import type { EntityNav } from '../../utils/entityLens';
	import EntityContract from '../entity-contract/EntityContract.svelte';
	import EntityMeasures from './EntityMeasures.svelte';
	import EntitySource from './EntitySource.svelte';
	import EntitySummary from './EntitySummary.svelte';
	let {
		entity,
		contract,
		measure,
		record,
		tab,
		nav
	}: {
		entity: ExplorerEntity;
		contract: ContractRow[];
		measure: EntityMeasure;
		record: HarnessRecord | null;
		/** The open tab; without one Details shows the contract and nothing of the source. */
		tab?: ExplorerTab;
		/** The screen's navigation and revision-scoped source modal action. */
		nav: EntityNav;
	} = $props();
</script>

<div role="tabpanel" aria-label={`${entity.name} details`}>
	{#if tab === 'source'}
		<EntitySource {entity} {nav} />
	{:else if tab === 'measurements'}
		<EntityMeasures unit={entity.unit} {record} />
	{:else}
		<!-- The same typed contract as the Contract tab, with the size and performance it is held to. -->
		<div class="ex-stack">
			<EntityContract unit={entity.unit} category={entity.category} {contract} />
			<EntitySummary {measure} />
		</div>
	{/if}
</div>

<style>
	.ex-stack {
		display: grid;
		gap: 16px;
		min-width: 0;
	}
</style>
