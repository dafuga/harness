<script lang="ts">
	import Select from '$shared/Select.svelte';
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
	const heading = $derived(workspace.category[0].toUpperCase() + workspace.category.slice(1));
	/** Only a verified entity has passed; a failed, unverified or unknown one is unproven. */
	const proofOf = (e: CatalogEntity) => (e.verification === 'verified' ? 'passed' : 'unproven');
	function reset() {
		search = '';
		changed = false;
		verification = 'all';
		planning = 'all';
	}
	const entities = $derived(
		(workspace.snapshot?.entities || [])
			.filter(
				(e) =>
					e.category === workspace.category &&
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
		/><label class="checkbox"><input type="checkbox" bind:checked={changed} /> Changed only</label
		><Select label="Verification filter" bind:value={verification}
			><option value="all">All verification</option><option value="passed">Verified</option><option
				value="unproven">Not verified</option
			></Select
		><Select label="Planning filter" bind:value={planning}
			><option value="all">All planning</option><option value="planned">Planned</option><option
				value="implemented">Implemented</option
			></Select
		><Select label="Sort catalog" bind:value={sort}
			><option value="title">Name</option><option value="version">Design version</option></Select
		>
	</div>
	{#if search || changed || verification !== 'all' || planning !== 'all'}<button onclick={reset}
			>Clear filters</button
		>{/if}
	<div class="card-grid">
		{#each entities as entity (entity.id)}<EntityCard {entity} {workspace} />{:else}<p
				class="empty"
			>
				No {workspace.category} match this view.
				<button onclick={reset}>Show all {workspace.category}</button>
			</p>{/each}
	</div>
</main>
