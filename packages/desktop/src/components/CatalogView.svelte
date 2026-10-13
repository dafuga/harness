<script lang="ts">
	import Select from '$shared/Select.svelte';
	import { explorerName } from '../../../reports/src/utils/explorerName';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import EntityCard from './EntityCard.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	let search = $state('');
	let sort = $state('title');
	let changed = $state(false);
	const heading = $derived(workspace.category[0].toUpperCase() + workspace.category.slice(1));
	const entities = $derived(
		(workspace.snapshot?.entities || [])
			.filter(
				(e) =>
					e.category === workspace.category &&
					`${explorerName(e)} ${e.summary}`.toLowerCase().includes(search.toLowerCase()) &&
					(!changed || e.changed)
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
	<div class="catalog-tools">
		<input
			aria-label={`Search ${workspace.category}`}
			placeholder={`Search ${workspace.category}…`}
			bind:value={search}
		/><label class="checkbox"><input type="checkbox" bind:checked={changed} /> Changed only</label
		><Select label="Sort catalog" bind:value={sort}
			><option value="title">Name</option><option value="version">Design version</option></Select
		>
	</div>
	<div class="card-grid">
		{#each entities as entity (entity.id)}<EntityCard {entity} {workspace} />{:else}<p
				class="empty"
			>
				No {workspace.category} match this view.
			</p>{/each}
	</div>
</main>
