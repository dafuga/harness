<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { ExplorerEntity, ExplorerTab } from '../../models/explorer-ui/Explorer.types';
	import type { HarnessRecord } from '../../models/explorer-ui/Harness.types';
	import type { ContractRow } from '../../utils/explorer-ui/entityContract';
	import type { EntityMeasure } from '../../utils/explorer-ui/entityMeasure';
	import type { EntityNav } from '../../utils/explorer-ui/entityLens';
	import EntityContract from './entity-contract/EntityContract.svelte';
	import EntityMeasures from './EntityMeasures.svelte';
	import EntitySource from './EntitySource.svelte';
	import EntitySummary from './EntitySummary.svelte';
	let {
		entity,
		contract,
		measure,
		record,
		tab,
		repository,
		commit,
		nav
	}: {
		entity: ExplorerEntity;
		contract: ContractRow[];
		measure: EntityMeasure;
		record: HarnessRecord | null;
		/** The open tab; without one Details shows the contract and nothing of the source. */
		tab?: ExplorerTab;
		repository?: string;
		commit: string;
		nav?: EntityNav;
	} = $props();
</script>

<hx-div
	role="tabpanel"
	aria-label={`${entity.name} details`}
	data-harness-component="harness-entity-details"
>
	{#if tab === 'source'}
		<EntitySource unit={entity.unit} {repository} {commit} {entity} {nav} />
	{:else if tab === 'measurements'}
		<EntityMeasures unit={entity.unit} {record} />
	{:else}
		<!-- The same typed contract as the Contract tab, with the size and performance it is held to. -->
		<hx-div class="ex-stack">
			<EntityContract unit={entity.unit} category={entity.category} {contract} />
			<EntitySummary {measure} />
		</hx-div>
	{/if}
</hx-div>

<style>
	.ex-stack {
		display: grid;
		gap: var(--hx-space-16);
		min-width: 0;
	}
</style>
