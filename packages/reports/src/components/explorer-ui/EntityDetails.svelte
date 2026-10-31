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
		/**
		 * The open tab; without one Details shows the contract and nothing of the source.
		 * `summary` is not a route tab: it shows the performance profile alone.
		 */
		tab?: ExplorerTab | 'summary';
		repository?: string;
		commit: string;
		nav?: EntityNav;
	} = $props();
</script>

<hx-div
	role="tabpanel"
	aria-label={`${entity.name} details`}
	class:measures={tab === 'measurements'}
	data-harness-component="harness-entity-details"
>
	{#if tab === 'source'}
		<EntitySource unit={entity.unit} {repository} {commit} {entity} {nav} />
	{:else if tab === 'measurements'}
		<EntityMeasures unit={entity.unit} {record} />
	{:else if tab === 'summary'}
		<EntitySummary {measure} />
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
	/* A phone reads a measurement as a block: its metric, then each figure beside its label. Four
	   columns would leave the limit a few letters wide. The labels repeat the column headers of
	   EntityMeasures, which stay in the table for assistive technology. */
	@media (max-width: 480px) {
		.measures :global(.ex-mini thead) {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
		.measures :global(.ex-mini),
		.measures :global(.ex-mini tbody) {
			display: block;
		}
		.measures :global(.ex-mini tbody tr) {
			display: grid;
			grid-template-columns: max-content minmax(0, 1fr);
			gap: var(--hx-space-4) var(--hx-space-12);
			padding-bottom: var(--hx-space-12);
		}
		.measures :global(.ex-mini tbody tr + tr) {
			padding-top: var(--hx-space-12);
			border-top: var(--hx-border-thin) solid var(--hx-color-border);
		}
		.measures :global(.ex-mini tbody :is(th, td)) {
			grid-column: 1 / -1;
			min-width: 0;
			padding: 0;
			border: 0;
			overflow-wrap: break-word;
		}
		.measures :global(.ex-mini tbody th) {
			color: var(--hx-color-text);
			font-weight: var(--hx-style-weight-semibold);
		}
		/* Every row shares one label column, so each value starts at the same edge. */
		.measures :global(.ex-mini tbody td) {
			display: grid;
			grid-template-columns: subgrid;
		}
		.measures :global(.ex-mini tbody td::before) {
			color: var(--hx-color-text-supporting);
		}
		.measures :global(.ex-mini tbody td:nth-of-type(1)::before) {
			content: 'Measured';
		}
		.measures :global(.ex-mini tbody td:nth-of-type(2)::before) {
			content: 'Limit';
		}
		.measures :global(.ex-mini tbody td:nth-of-type(3)::before) {
			content: 'Note';
		}
	}
</style>
