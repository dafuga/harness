<script lang="ts">
	import {
		catalogOrders,
		orderLabels,
		type CatalogFilter,
		type CatalogOrder
	} from '../../utils/entityCatalog';
	import Select from '../Select.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	/** Verification and usage narrow the list as well; the root reads them, and unset means all. */
	type Filter = CatalogFilter & { verification?: string; usage?: string };
	let {
		noun,
		filter = $bindable()
	}: {
		/** What is searched, in the plural and lower case: `pages`, `components`. */
		noun: string;
		filter: Filter;
	} = $props();
	const verifications = [
		['all', 'All verification'],
		['passed', 'Verified'],
		['unproven', 'Not verified']
	];
	const usages = [
		['all', 'All usage'],
		['shared', 'Shared'],
		['exclusive', 'Single use']
	];
</script>

<div class="ex-controls" role="search" aria-label={`Find ${noun}`}>
	<label class="ex-search">
		<HarnessIcon name="search" size={18} />
		<input
			type="search"
			placeholder={`Search ${noun}…`}
			aria-label={`Search ${noun}`}
			bind:value={filter.search}
		/>
	</label>
	<div class="ex-filters">
		<label class="ex-toggle">
			<input type="checkbox" role="switch" bind:checked={filter.changedOnly} />
			<span class="ex-toggle-track" aria-hidden="true"></span>
			<span>Changed only</span>
		</label>
		<span class="ex-filter">
			<Select
				label="Verification filter"
				bind:value={() => filter.verification ?? 'all', (chosen) => (filter.verification = chosen)}
			>
				{#each verifications as [id, text] (id)}<option value={id}>{text}</option>{/each}
			</Select>
		</span>
		<span class="ex-filter">
			<Select
				label="Usage filter"
				bind:value={() => filter.usage ?? 'all', (chosen) => (filter.usage = chosen)}
			>
				{#each usages as [id, text] (id)}<option value={id}>{text}</option>{/each}
			</Select>
		</span>
		<span class="ex-order">
			<Select
				label="Order"
				bind:value={() => filter.order, (chosen) => (filter.order = chosen as CatalogOrder)}
			>
				{#each catalogOrders as id (id)}<option value={id}>Order: {orderLabels[id]}</option>{/each}
			</Select>
		</span>
	</div>
</div>

<style>
	/* The filters keep together: beside the search while there is room, otherwise in a row beneath. */
	.ex-filters {
		display: flex;
		flex: 1 1 auto;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 24px;
		min-width: 0;
	}
	/* Each as wide as its longest choice, so no choice is cut short. */
	.ex-filter {
		flex: 0 1 auto;
		min-width: 0;
	}
	.ex-filter :global(.report-select) {
		display: block;
	}
	@media (max-width: 760px) {
		.ex-filters {
			gap: 12px;
		}
		.ex-filter {
			flex-grow: 1;
		}
	}
</style>
