<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import EntityCard from './EntityCard.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	let search = $state('');
	let sort = $state('title');
	let changed = $state(false);
	let creating = $state(false);
	let title = $state('');
	let goal = $state('');
	let error = $state('');
	let saving = $state(false);
	let dialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (creating && dialog && !dialog.open) dialog.showModal();
	});
	const heading = $derived(workspace.category[0].toUpperCase() + workspace.category.slice(1));
	const entities = $derived(
		(workspace.snapshot?.entities || [])
			.filter(
				(e) =>
					e.category === workspace.category &&
					`${e.title} ${e.summary}`.toLowerCase().includes(search.toLowerCase()) &&
					(!changed || e.changed)
			)
			.sort((a, b) =>
				sort === 'title'
					? a.title.localeCompare(b.title)
					: (b.latestVersion || '').localeCompare(a.latestVersion || '')
			)
	);
	async function create() {
		if (!workspace.bridge || !title.trim() || !goal.trim()) return;
		saving = true;
		error = '';
		try {
			const entity = await workspace.bridge.createPlan({
				category: workspace.category,
				title: title.trim(),
				goal: goal.trim(),
				...workspace.context
			});
			creating = false;
			await workspace.refresh();
			await workspace.navigate(workspace.path(entity.category, entity.id));
		} catch (cause) {
			error = String(cause);
		} finally {
			saving = false;
		}
	}
</script>

<main class="catalog">
	<p class="breadcrumb">{workspace.snapshot?.project.name} › {heading}</p>
	<div class="row">
		<div>
			<h1>{heading}</h1>
			<p>Browse {workspace.category} and understand your project.</p>
		</div>
		{#if workspace.capabilities.planning}<button
				class="outline gold"
				disabled={!workspace.snapshot?.writable}
				onclick={() => (creating = true)}>+ New {workspace.category.slice(0, -1)}</button
			>{/if}
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
{#if creating}<div class="modal-backdrop">
		<dialog
			bind:this={dialog}
			oncancel={() => (creating = false)}
			class="modal"
			aria-modal="true"
			aria-label="New plan"
		>
			<h2>New {workspace.category.slice(0, -1)}</h2>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					void create();
				}}
			>
				<label>Title<input bind:value={title} required maxlength="160" /></label><label
					>Goal<textarea bind:value={goal} required rows="4"></textarea></label
				>{#if error}<p role="alert">{error}</p>{/if}
				<div class="row">
					<button type="button" onclick={() => (creating = false)}>Cancel</button><button
						class="primary"
						disabled={saving}>Create plan</button
					>
				</div>
			</form>
		</dialog>
	</div>{/if}
