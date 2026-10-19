<script lang="ts">
	import { helperContract } from '../../../../src/utils/helperContract';
	import Select from '$shared/Select.svelte';
	import FilterDialog from '$shared/FilterDialog.svelte';
	import { explorerName } from '../../../reports/src/utils/explorerName';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import type { CatalogEntity } from '../models/Desktop.types';
	import EntityCard from './EntityCard.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	let search = $state('');
	let sort = $state('title');
	let changed = $state(false);
	let verification = $state('all');
	let planning = $state('all');
	const heading = $derived(
		workspace.category === 'functions'
			? 'Helpers'
			: workspace.category[0].toUpperCase() + workspace.category.slice(1)
	);
	/** Only a verified entity has passed; a failed, unverified or unknown one is unproven. */
	const proofOf = (e: CatalogEntity) => (e.verification === 'verified' ? 'passed' : 'unproven');
	function reset() {
		search = '';
		changed = false;
		verification = 'all';
		planning = 'all';
	}
	const active = $derived(
		Number(changed) +
			Number(verification !== 'all') +
			Number(planning !== 'all') +
			Number(sort !== 'title')
	);
	function resetFilters() {
		changed = false;
		verification = 'all';
		planning = 'all';
		sort = 'title';
	}
	const entities = $derived(
		(workspace.snapshot?.entities || [])
			.filter(
				(e) =>
					e.category === workspace.category &&
					(e.category !== 'functions' || e.planned || e.helperContracts?.some(helperContract)) &&
					`${explorerName(e)} ${e.summary}`.toLowerCase().includes(search.toLowerCase()) &&
					(!changed || e.changed) &&
					(verification === 'all' || proofOf(e) === verification) &&
					(planning === 'all' || e.hasPlan === (planning === 'planned'))
			)
			.sort((a, b) =>
				sort === 'title'
					? explorerName(a).localeCompare(explorerName(b))
					: (b.latestVersion || '').localeCompare(a.latestVersion || '')
			)
	);
</script>

<main class="catalog">
	<p class="breadcrumb">{workspace.snapshot?.project.name} › {heading}</p>
	<div class="row">
		<div>
			<h1>{heading}</h1>
			<p>Browse {workspace.category} and understand your project.</p>
		</div>
	</div>
	<!-- Right above the list: its search first, then filters that narrow it together. -->
	<div class="catalog-tools" role="search" aria-label={`Find ${workspace.category}`}>
		<input
			type="search"
			aria-label={`Search ${workspace.category}`}
			placeholder={`Search ${workspace.category}…`}
			bind:value={search}
		/><FilterDialog {active} onreset={resetFilters}
			><label class="checkbox"><input type="checkbox" bind:checked={changed} /> Changed only</label
			><label class="filter-field"
				><span>Verification</span><Select label="Verification filter" bind:value={verification}
					><option value="all">All verification</option><option value="passed">Verified</option
					><option value="unproven">Not verified</option></Select
				></label
			><label class="filter-field"
				><span>Planning</span><Select label="Planning filter" bind:value={planning}
					><option value="all">All planning</option><option value="planned">Planned</option><option
						value="implemented">Implemented</option
					></Select
				></label
			><label class="filter-field"
				><span>Order</span><Select label="Sort catalog" bind:value={sort}
					><option value="title">Name</option><option value="version">Design version</option
					></Select
				></label
			></FilterDialog
		>
	</div>
	<div class="card-grid">
		{#each entities as entity (entity.id)}<EntityCard {entity} {workspace} />{:else}<p
				class="empty"
			>
				No {workspace.category} match this view.
				<button onclick={reset}>Show all {workspace.category}</button>
			</p>{/each}
	</div>
</main>

<style>
	.catalog-tools {
		flex-wrap: nowrap;
		gap: 10px;
	}
	.catalog-tools > input {
		flex: 1 1 0;
		min-width: 0;
		min-height: 48px;
	}
</style>
