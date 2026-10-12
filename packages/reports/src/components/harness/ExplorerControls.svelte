<script lang="ts">
	import {
		catalogOrders,
		orderLabels,
		type CatalogFilter,
		type CatalogOrder
	} from '../../utils/entityCatalog';
	import Select from '../Select.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	let {
		noun,
		filter = $bindable()
	}: {
		/** What is searched, in the plural and lower case: `pages`, `components`. */
		noun: string;
		filter: CatalogFilter;
	} = $props();
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
	<label class="ex-toggle">
		<input type="checkbox" role="switch" bind:checked={filter.changedOnly} />
		<span class="ex-toggle-track" aria-hidden="true"></span>
		<span>Changed only</span>
	</label>
	<span class="ex-order">
		<Select
			label="Order"
			bind:value={() => filter.order, (chosen) => (filter.order = chosen as CatalogOrder)}
		>
			{#each catalogOrders as id (id)}<option value={id}>Order: {orderLabels[id]}</option>{/each}
		</Select>
	</span>
</div>
