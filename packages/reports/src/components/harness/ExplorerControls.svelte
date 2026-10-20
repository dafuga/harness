<script lang="ts">
	import {
		catalogOrders,
		orderLabels,
		type CatalogFilter,
		type CatalogOrder
	} from '../../utils/entityCatalog';
	import Select from '../Select.svelte';
	import FilterDialog from '../FilterDialog.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	let {
		noun,
		filter = $bindable()
	}: {
		/** What is searched, in the plural and lower case: `pages`, `components`. */
		noun: string;
		filter: CatalogFilter;
	} = $props();
	const verifications = [
		['all', 'All verification'],
		['passed', 'Verified'],
		['unproven', 'Not verified']
	];
	const usages = [
		['all', 'All usage'],
		['shared', 'Shared'],
		['exclusive', 'Not shared']
	];
	const active = $derived(
		Number(filter.changedOnly) +
			Number((filter.verification ?? 'all') !== 'all') +
			Number((filter.usage ?? 'all') !== 'all') +
			Number(filter.order !== 'name')
	);
	function resetFilters() {
		filter = { ...filter, changedOnly: false, verification: 'all', usage: 'all', order: 'name' };
	}
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
	<FilterDialog {active} onreset={resetFilters}>
		<label class="ex-toggle">
			<input type="checkbox" role="switch" bind:checked={filter.changedOnly} />
			<span class="ex-toggle-track" aria-hidden="true"></span>
			<span>Changed only</span>
		</label>
		<label class="filter-field"
			><span>Verification</span>
			<Select
				label="Verification filter"
				bind:value={() => filter.verification ?? 'all', (chosen) => (filter.verification = chosen)}
			>
				{#each verifications as [id, text] (id)}<option value={id}>{text}</option>{/each}
			</Select>
		</label>
		<label class="filter-field"
			><span>Usage</span>
			<Select
				label="Usage filter"
				bind:value={() => filter.usage ?? 'all', (chosen) => (filter.usage = chosen)}
			>
				{#each usages as [id, text] (id)}<option value={id}>{text}</option>{/each}
			</Select>
		</label>
		<label class="filter-field"
			><span>Order</span>
			<Select
				label="Order"
				bind:value={() => filter.order, (chosen) => (filter.order = chosen as CatalogOrder)}
			>
				{#each catalogOrders as id (id)}<option value={id}>Order: {orderLabels[id]}</option>{/each}
			</Select>
		</label>
	</FilterDialog>
</div>

<style>
	:global(.ex-content .ex-controls) {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 10px;
	}
	:global(.ex-content .ex-controls .ex-search) {
		flex: 1 1 0;
	}
</style>
