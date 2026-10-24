<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { helperContract } from '../../../../../src/utils/helperContract';
	import Select from '$shared/Select.svelte';
	import FilterDialog from '$shared/FilterDialog.svelte';
	import { explorerName } from '../../../../reports/src/utils/explorerName';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import type { CatalogEntity } from '../../models/development-tooling/Desktop.types';
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
	const nameOf = (entity: CatalogEntity) =>
		entity.category === 'functions' && !entity.planned ? entity.title : explorerName(entity);
	const searchText = (entity: CatalogEntity) => {
		const name = nameOf(entity);
		return `${name} ${name.replace(/([a-z0-9])([A-Z])/g, '$1 $2')} ${entity.summary}`.toLowerCase();
	};
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
					searchText(e).includes(search.toLowerCase()) &&
					(!changed || e.changed) &&
					(verification === 'all' || proofOf(e) === verification) &&
					(planning === 'all' || e.hasPlan === (planning === 'planned'))
			)
			.sort((a, b) =>
				sort === 'title'
					? nameOf(a).localeCompare(nameOf(b))
					: (b.latestVersion || '').localeCompare(a.latestVersion || '')
			)
	);
</script>

<hx-main class="catalog">
	<hx-p class="breadcrumb">{workspace.snapshot?.project.name} › {heading}</hx-p>
	<hx-div class="row">
		<hx-div>
			<hx-h1>{heading}</hx-h1>
			<hx-p>Browse {heading.toLowerCase()} and understand your project.</hx-p>
		</hx-div>
	</hx-div>
	<!-- Right above the list: its search first, then filters that narrow it together. -->
	<hx-div class="catalog-tools" role="search" aria-label={`Find ${workspace.category}`}>
		<hx-input
			type="search"
			aria-label={`Search ${workspace.category}`}
			placeholder={`Search ${workspace.category}…`}
			bind:value={search}
		/><FilterDialog {active} onreset={resetFilters}
			><hx-label class="checkbox"
				><hx-input type="checkbox" bind:checked={changed} /> Changed only</hx-label
			><hx-label class="filter-field"
				><hx-span>Verification</hx-span><Select
					label="Verification filter"
					bind:value={verification}
					><hx-option value="all">All verification</hx-option><hx-option value="passed"
						>Verified</hx-option
					><hx-option value="unproven">Not verified</hx-option></Select
				></hx-label
			><hx-label class="filter-field"
				><hx-span>Planning</hx-span><Select label="Planning filter" bind:value={planning}
					><hx-option value="all">All planning</hx-option><hx-option value="planned"
						>Planned</hx-option
					><hx-option value="implemented">Implemented</hx-option></Select
				></hx-label
			><hx-label class="filter-field"
				><hx-span>Order</hx-span><Select label="Sort catalog" bind:value={sort}
					><hx-option value="title">Name</hx-option><hx-option value="version"
						>Design version</hx-option
					></Select
				></hx-label
			></FilterDialog
		>
	</hx-div>
	<hx-div class="card-grid">
		{#each entities as entity (entity.id)}<EntityCard {entity} {workspace} />{:else}<hx-p
				class="empty"
			>
				No {workspace.category} match this view.
				<hx-button onclick={reset}>Show all {workspace.category}</hx-button>
			</hx-p>{/each}
	</hx-div>
</hx-main>

<style>
	.catalog-tools {
		flex-wrap: nowrap;
		gap: var(--hx-space-10);
	}
	.catalog-tools > input {
		flex: 1 1 0;
		min-width: 0;
		min-height: 48px;
	}
</style>
