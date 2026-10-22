<script lang="ts">
	import {
		catalogOrders,
		orderLabels,
		type CatalogFilter,
		type CatalogOrder
	} from '../../../utils/explorer-ui/entityCatalog';
	import Select from '../../shared-primitives/Select.svelte';
	import FilterDialog from '../../shared-primitives/FilterDialog.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	let {
		noun,
		filter = $bindable(),
		groups = []
	}: {
		/** What is searched, in the plural and lower case: `pages`, `components`. */
		noun: string;
		filter: CatalogFilter;
		/** The categories of every entity before any filter, each with how many it holds. */
		groups?: Array<{ id: string; title: string; count: number }>;
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
	/** Only the chosen categories still offered count; none chosen shows every category. */
	const chosen = $derived(groups.filter((group) => filter.groups?.includes(group.id)).length);
	const active = $derived(
		Number(filter.changedOnly) +
			Number((filter.verification ?? 'all') !== 'all') +
			Number((filter.usage ?? 'all') !== 'all') +
			Number(filter.order !== 'name') +
			chosen
	);
	function resetFilters() {
		filter = {
			...filter,
			changedOnly: false,
			verification: 'all',
			usage: 'all',
			order: 'name',
			groups: []
		};
	}
	function choose(id: string, checked: boolean) {
		const others = (filter.groups ?? []).filter((other) => other !== id);
		filter.groups = checked ? [...others, id] : others;
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
		{#if groups.length}
			<fieldset class="ex-group-filter">
				<legend>Categories</legend>
				<div class="ex-group-list">
					{#each groups as group (group.id)}
						<label class="ex-group-option">
							<input
								type="checkbox"
								value={group.id}
								checked={filter.groups?.includes(group.id) ?? false}
								onchange={(event) => choose(group.id, event.currentTarget.checked)}
							/>
							<span class="ex-group-title">{group.title}</span>
							<span class="ex-group-count">{group.count}</span>
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}
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
	/* A fieldset is as wide as its longest label unless told otherwise; this one wraps instead. */
	.ex-group-filter {
		min-inline-size: 0;
		margin: 0;
		padding: 0;
		border: 0;
		font-size: 14px;
	}
	.ex-group-filter legend {
		margin-bottom: 7px;
		padding: 0;
	}
	/* Many categories scroll here, so Reset and Done stay within reach on a phone. */
	.ex-group-list {
		display: grid;
		gap: 2px;
		max-height: min(280px, 40dvh);
		padding: 4px;
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-width: thin;
		border: 1px solid var(--line, #2c4259);
		border-radius: 8px;
		background: var(--bg, #0c1a26);
	}
	:global(.ex-content) .ex-group-option {
		display: grid;
		grid-template-columns: 18px minmax(0, 1fr) auto;
		align-items: start;
		gap: 10px;
		box-sizing: border-box;
		min-height: 44px;
		padding: 11px 10px;
		border-radius: 6px;
		line-height: 1.4;
		cursor: pointer;
	}
	.ex-group-option:hover {
		background: rgba(255, 255, 255, 0.04);
	}
	.ex-group-option:has(:checked) {
		background: rgba(243, 195, 59, 0.08);
	}
	:global(.ex-content) .ex-group-option input[type="checkbox"] {
		width: 18px;
		min-width: 18px;
		max-width: 18px;
		padding: 0;
		height: 18px;
		margin: 1px 0 0;
	}
	.ex-group-title {
		overflow-wrap: anywhere;
	}
	.ex-group-count {
		color: var(--muted, #9fb0c6);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
</style>
