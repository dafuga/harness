<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_lo2f475bxn -->
<!-- @harness-view overview -->
<script lang="ts">
	import EmptyState from '$shared/explorer-ui/explorer-kit/EmptyState.svelte';
	import { helperContract } from '../../../../../src/utils/development-tooling/helperContract';
	import Select from '$shared/Select.svelte';
	import FilterDialog from '$shared/FilterDialog.svelte';
	import { explorerName } from '$reports/utils/explorer-ui/explorerName';
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
			: workspace.category === 'apis'
				? 'APIs'
				: workspace.category[0].toUpperCase() + workspace.category.slice(1)
	);
	/** One quiet line: how many are listed, and of how many when search or filters narrow it. */
	const count = $derived.by(() => {
		const total = (workspace.snapshot?.entities || []).filter(
			(e) => e.category === workspace.category
		).length;
		const plural = heading === 'APIs' ? heading : heading.toLowerCase();
		const noun = entities.length === 1 ? plural.replace(/s$/, '') : plural;
		const narrowed = search || active > 0;
		return narrowed
			? `${entities.length} of ${total} ${plural} shown`
			: `${entities.length} ${noun}`;
	});
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
	<hx-div class="row">
		<hx-div>
			<hx-h1>{heading}</hx-h1>
			<hx-p class="catalog-count" role="status">{count}</hx-p>
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
			><hx-label class="switch-row"
				><hx-span>Changed only</hx-span><hx-input
					type="checkbox"
					role="switch"
					bind:checked={changed}
				/></hx-label
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
		{#each entities as entity (entity.id)}<EntityCard {entity} {workspace} />{:else}<EmptyState
				as="p"
				className="empty catalog-view-empty"
			>
				No {workspace.category} match this view.
				<hx-button onclick={reset}>Show all {workspace.category}</hx-button>
			</EmptyState>{/each}
	</hx-div>
</hx-main>

<style>
	.catalog-tools {
		flex-wrap: nowrap;
		gap: var(--hx-space-10);
	}
	.catalog-count {
		margin: var(--hx-space-4) 0 0;
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-sm);
	}
	.catalog-tools > input {
		flex: 1 1 0;
		min-width: 0;
		min-height: 48px;
	}
	/* A 44px row: the name on the left, the switch on the right; the whole row toggles it. */
	.switch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--hx-space-12);
		min-height: 44px;
		cursor: pointer;
	}
	.switch-row > input {
		position: relative;
		flex: none;
		appearance: none;
		width: 44px;
		height: 26px;
		margin: 0;
		border: var(--hx-border-thin) solid var(--hx-color-border-strong);
		border-radius: 999px;
		background: var(--hx-color-surface);
		cursor: pointer;
	}
	.switch-row > input::before {
		content: '';
		position: absolute;
		top: 4px;
		left: 4px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--hx-color-text-muted);
		transition: transform 120ms ease;
	}
	.switch-row > input:checked {
		border-color: var(--hx-color-primary);
		background: var(--hx-color-primary);
	}
	.switch-row > input:checked::before {
		background: var(--hx-color-surface);
		transform: translateX(18px);
	}
	.switch-row > input:focus-visible {
		outline: var(--hx-border-thick) solid var(--hx-color-primary);
		outline-offset: var(--hx-border-thick);
	}
</style>
